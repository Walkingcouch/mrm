# Setup guide

Do these steps once for **staging**, then again for **production** (separate Supabase projects,
separate website deployments, separate app builds). Nothing here buys a service or publishes an app;
those need the owner's go-ahead.

## 1. Local development

Requirements: Node 22.18+, a local Postgres 15+ (for database tests), Supabase CLI (optional).

```bash
# Database tests (throwaway DB, no Supabase needed)
PGUSER=postgres ./scripts/test-db.sh

# Unit tests
node --test supabase/functions/_shared/dispatch-core.test.ts
(cd mobile && npm install && npm test && npx tsc --noEmit)
(cd admin  && npm install && npx tsc --noEmit && npx eslint src)

# Run the website against a Supabase project
cp admin/.env.example admin/.env.local   # fill in values
(cd admin && npm run dev)

# Run the app (needs a development build because of push notifications)
cp mobile/.env.example mobile/.env       # fill in values
(cd mobile && npx eas-cli@latest build --profile development --platform android)  # or ios
(cd mobile && npx expo start --dev-client)
```

## 2. Supabase project

1. Create the project (Pro plan for production — free projects pause after a week idle). Region: Sydney.
2. Apply migrations: `supabase link --project-ref <ref>` then `supabase db push`
   (or paste `supabase/migrations/*.sql` in order into the SQL editor).
3. Auth settings:
   * Disable public sign-ups (Authentication → Sign In / Providers → "Allow new users to sign up" off).
     Admins are created only by invitation from the website.
   * Site URL = the admin website address. Add `<site>/auth/confirm` to redirect URLs.
   * Email templates — make **Invite user** and **Reset password** links point to:
     `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite` (use `type=recovery` for reset).
   * Configure custom SMTP before go-live (the built-in sender is rate-limited).
4. Edge function:
   ```bash
   supabase functions deploy dispatch-push --no-verify-jwt
   supabase secrets set --env-file supabase/functions/.env   # PUSH_DISPATCH_SECRET (+ EXPO_ACCESS_TOKEN if used)
   ```
5. Enable `pg_cron` and `pg_net` extensions, store the two Vault secrets, then run
   `supabase/setup/push_sweep_cron.sql`.
6. Bootstrap the first App Developer (one time, SQL editor):
   create the user under Authentication → Users → "Invite user", then
   ```sql
   insert into public.admin_accounts (user_id, email, display_name, tier)
   select id, email, 'App Developer', 'app_developer' from auth.users where email = '<developer email>';
   ```
   Everyone else is created from the website (App Developer appoints the Super Admin; the Super
   Admin then adds administrators).
7. Optional: `supabase/setup/role_templates.sql` (starter roles + sources). Staging only:
   `supabase/setup/demo_seed_staging_only.sql` (rows marked [DEMO]).

## 3. Admin website

Deploy `admin/` to Vercel (Pro, since Hobby is non-commercial) or any Node 22 host. Set the variables
in `admin/.env.example`. `SUPABASE_SERVICE_ROLE_KEY` must be a server-only variable.
Point a domain (e.g. `admin.<company domain>`) at it and set `NEXT_PUBLIC_SITE_URL` to match.

## 4. Mobile apps

1. `cd mobile && npx eas-cli@latest init` (creates the Expo project; record `EAS_PROJECT_ID`).
2. Set EAS environment variables per profile from `mobile/.env.example`
   (`IOS_BUNDLE_ID`/`ANDROID_PACKAGE` come from docs/RELEASE.md — never guessed).
3. Push credentials:
   * iOS: `npx eas-cli@latest credentials` → create/upload an APNs key in the owner's Apple account.
   * Android: create a Firebase project for the app's package name and upload the FCM V1 service
     account key to EAS (Expo docs: "Add Android FCM V1 credentials").
4. Replace placeholders: `assets/brand/logo.png` (authorised Glencore logo), app icons in `assets/`,
   colours in `src/lib/theme.ts` per brand rules.
5. Test builds: `eas build --profile staging --platform all`, distribute via TestFlight / Play internal testing.

## 5. Content entry guide (for the Super Admin)

Sign in at the admin website (works on a phone browser).

| Section | What to do |
|---|---|
| Flight Tracker | Paste the FlightAware page for McArthur River Mine Airport (not the home/search page). |
| Weather | Paste the WillyWeather page for the airport. Optionally paste the free widget code (App Developer/Super Admin). Test on phones before relying on the widget. |
| Timetables, MRM Village | Open the entry → **Upload PDF / Replace PDF**. No title or date needed. |
| Memorandum | **Upload a new PDF** for each month's issue. Newest shows first. **Remove** old issues when no longer needed. |
| HR & Payroll, Wellbeing, Report & Fix It, Call Us, Find Us | **Add** a link/form, information text, phone number or map link; **Edit**, ↑/↓ to reorder, **Remove**. |
| Employee Messages | Write, optionally attach PDFs/images, **Send**. Sends immediately. |
| Administrators / Roles / Message sources | Invite people, tick roles; create roles and tick permissions; name the teams messages come from. |

Everything appears in both apps the next time a section is opened — no app update needed.
**All app content is publicly viewable without login. Do not upload confidential documents**
(an unlisted link is not private).
