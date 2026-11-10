# Architecture

Replacement for the white-label McArthur River Mine app (brief v1.1, 10 Nov 2026).
Labelled implementation choices are marked **[choice]**; pending owner decisions are marked **[PENDING]**.

## Components

| Part | Technology | Hosted on | Notes |
|---|---|---|---|
| iOS + Android apps | Expo SDK 58 / React Native 0.88, Expo Router (drawer) **[choice]** | App Store / Google Play via EAS Build | One codebase, no login, no admin UI |
| Admin website | Next.js 16 (App Router, server actions) **[choice]** | Vercel Pro or any Node host **[choice]** | Mobile-first; separate from the apps |
| Database, auth, files | Supabase (Postgres, Auth, Storage) **[choice]** | Supabase Pro | All permissions enforced in SQL |
| Push dispatch | Supabase Edge Function `dispatch-push` + pg_cron sweep | Supabase | Sends through Expo Push Service (free) → APNs/FCM |
| PDF viewer (Android) | Self-hosted pdf.js page at `/pdf-viewer/` on the admin site **[choice]** | Same as admin site | iOS uses the native WKWebView PDF renderer |

Why: one TypeScript language across apps, website and functions; permission rules live in one place
(the database) so the website, a direct API call, or a future tool all hit the same checks; no
paid flight/weather APIs; Expo push is free and supports an absolute expiry time.

## Repository layout

```
mobile/      Expo app (src/app = screens, src/lib = data/push/seen logic, src/components)
admin/       Next.js admin website (src/app/(admin) pages, src/app/actions.ts server actions)
supabase/
  migrations/  schema, RLS, permission helpers, admin + app + push functions
  functions/   dispatch-push edge function + pure dispatch-core (unit tested)
  tests/       SQL tests run against a throwaway Postgres (scripts/test-db.sh)
  setup/       one-off SQL: pg_cron sweep, optional role templates, staging demo seed
docs/        architecture, setup, release, status/acceptance
```

## Data model (minimum conceptual entities → tables)

| Entity | Table |
|---|---|
| Admin account | `admin_accounts` (+ Supabase `auth.users`) — `tier` = app_developer / super_admin / delegate |
| Role | `roles` (name is a plain label) |
| Permission grant | `role_grants` (stable `permission_id` + section/entry or source scope) |
| Account-role assignment | `account_roles` |
| Section / content entry | `content_nodes` (13 fixed sections; entries: pdf, url, info, phone, map) |
| Stored file | storage buckets `content`, `messages`; path on the entry/attachment row |
| Configured message source | `message_sources` |
| Message / attachment | `messages` (source label snapshotted), `message_attachments` |
| Anonymous installation / push registration | `installations` (random id + hashed secret + Expo token) |
| Optional subscription | `installation_subscriptions` |
| Push idempotency | `push_deliveries` (one row per message × installation) |
| Local seen-message state | on the device only (AsyncStorage) — never sent to the server |

No employee, profile, document-version, approval or audit-log entities exist.

## Permission model

* Permission ids (stable): `content.access`, `content.upload`, `content.edit`, `content.delete`,
  `message.publish`, `push.department`, `push.global_general`, `push.global_emergency`.
* Content permissions are granted on a **section** (covers its entries) or a single **entry**.
  A delegate needs **both** `content.access` and the action on that section/entry (scope AND action).
  Kitchen = Menu entry only, so it cannot touch Gun Club, Village Map or HR — tested via direct calls.
* App Developer and Super Admin pass all content/message checks. Only they manage accounts/roles.
  **Hierarchy default:** only the App Developer appoints/removes Super Admins and App Developers.
  Nobody can change their own access; the last active App Developer cannot be disabled or deleted.
* Multiple roles per admin → union of grants. Deleting a role cascades its grants and assignments.
* Disabling an account takes effect on the next request (DB checks `disabled` every call) and the
  auth user is banned so tokens cannot be refreshed.
* Clients can only read public tables; every write goes through `SECURITY DEFINER` functions that
  re-check permissions. RLS is on for every table.

## PDF / file flow

1. Website asks the server for a signed upload URL (server checks permission first).
2. Browser uploads directly to Storage at a **new** path `<entryId>/<random>.pdf`.
3. Server checks the file's first bytes really are a PDF, then calls `admin_attach_pdf`, which
   swaps the entry's pointer in one transaction and returns the old path, which is then deleted.
   A failed upload never affects the live document; the new URL defeats stale caches; no versions kept.
Limits: PDFs 25 MB, attachments 15 MB (PDF/JPEG/PNG/WEBP/HEIC), 5 per message — enforced by the
bucket config, the server and the UI.

## Messaging & push flow

```
Admin presses Send (request id generated once per message)
  → admin_send_message: permission check, idempotent insert (same request id ⇒ same message),
    push_deadline = now + 24h fixed
  → website triggers dispatch-push (after responding)
      loop: push_claim_batch (inserts one push_deliveries row per installation — never twice)
            → Expo Push API with expiration = deadline (absolute; retries don't extend it)
            → push_record_results (DeviceNotRegistered clears the token)
      push_finish → done / pending (retry) / expired
  → pg_cron every minute: sweep pending messages still inside their window
```

Recipients: global general / emergency → every push-enabled installation. Departmental →
**[PENDING]** `departmental_push_mode`: `subscribers` (proposed default: devices that opted in under
Settings) or `everyone` (subscription controls disappear from the app). Switchable by the App
Developer on the website with no code change.

App side: foreground notifications are suppressed (no banner, no sound); nothing opens automatically
on launch/resume/reconnect; only a tapped OS notification navigates (once per notification id);
"seen" is recorded only after the detail view has laid out; Messages refreshes on every open.

## Recurring costs (indicative, USD, verify at sign-up)

| Item | Cost |
|---|---|
| Supabase Pro (needed: free projects pause after a week of inactivity) | ~$25 / month |
| Admin website hosting — Vercel Pro (Hobby is non-commercial only) | ~$20 / developer seat / month (or any Node host) |
| Apple Developer Program | $99 / year (owner's existing account) |
| Google Play developer account | one-off $25 (owner's existing account) |
| Expo/EAS | Free plan includes a small number of builds; Starter $19 / month if more are needed |
| Expo push notifications | Free (600/sec rate limit) |
| Domain for the admin site (optional) | ~$15–30 / year |
| FlightAware page, WillyWeather widget/page | Free |
