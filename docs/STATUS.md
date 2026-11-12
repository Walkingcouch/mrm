# Status — Stage 1 (10 Nov 2026)

Legend: ✅ implemented & automatically tested · 🟡 implemented, not yet verified on a live backend/device ·
⛔ blocked on an external input · — not applicable

## Acceptance checks (brief §12)

| | Check | Status | Evidence / what's left |
|---|---|---|---|
| A | Home = header, logo, hamburger only; no message UI ever | 🟡 | `mobile/src/app/(drawer)/index.tsx` renders only the logo; no code path presents messages automatically. Needs device check. |
| B | Menu opens all 13 sections on both platforms | 🟡 | Drawer built from DB order with offline fallback; Android JS bundle builds. Device check. |
| C | Flight link opens the mine airport page | ⛔ | Needs exact FlightAware URL from owner. In-app web view + browser fallback built. |
| D | Weather widget or URL fallback | ⛔ | Needs WillyWeather URL / widget code; widget must be device-tested. Fallback logic built. |
| E | PDFs render inside both apps | 🟡 | iOS native WebView; Android self-hosted pdf.js. Needs device check with real PDFs. |
| F | Replace PDF without metadata/preview/versions/store release | ✅ | SQL tests: label & position kept; new path per upload; old file deleted. |
| G | Newsletters are separate issues; no recoverable versions | ✅ | Memorandum = newest-first list of PDF entries; no version table exists. |
| H | Kitchen can replace Menu only, incl. direct API | ✅ | `10_permissions_test.sql` (Gun Club, timetable, HR all denied via direct calls). |
| I | Super Admin manages custom roles; rename keeps access | ✅ | Tested. Website UI built (🟡 live check). |
| J | Revocation removes access; no self-elevation | ✅ | Grant revoke, disable, role delete, self-change all tested. |
| K | Message = source + auto time + text + attachments; immediate send | ✅ | No title/category/schedule/approval columns (tested). |
| L | Repeated Send ⇒ one message, one push job | ✅ | Tested (same request id). Composer keeps the id across network retries. |
| M | One logical push per installation/message; no duplicate navigation | ✅ | DB guard tested; tap de-dupe unit-tested; foreground banners suppressed. |
| N | No push after 24h; message still readable | ✅ | Tested; Expo `expiration` = fixed deadline (unit-tested). |
| O | Seen only after render; failed fetch never marks seen | 🟡 | Marked in `onLayout` of the loaded body only. Device check. |
| P | Resume/reconnect never auto-open; Messages refreshes on open | 🟡 | `useFocusEffect` refresh; no auto-navigation code. Device check. |
| Q | Push denied ⇒ app still fully usable; no pop-up substitute | 🟡 | Permission result never gates content. Device check. |
| R | Global ⇒ all installations; departmental per chosen rule | ✅ / ⛔ | Both modes tested. **Owner must choose the rule.** |
| S | No login/profile/forms/paid APIs/offline docs/search/audit UI | ✅ (changed) | None exist, except offline docs: added at the owner's request (12 Nov 2026). PDFs in the menu are preloaded on Wi-Fi and opened PDFs are kept (250 MB cap, 30 MB per file); see `mobile/src/lib/pdf-cache.ts`. |
| T | Store-update feasibility from real account evidence | ⛔ | Needs owner's Apple/Google account access (docs/RELEASE.md). |
| U | Apps + website on the real backend | ⛔ | Needs a Supabase project (not created — no purchase without approval). |
| V | All admin workflows usable on phone browsers | 🟡 | Mobile-first CSS, no tables, 44px targets; production build passes. Needs phone check. |
| W | Maintain HR/Wellbeing/Report/Call/Find entries; unauthorised denied | ✅ | Tested add/edit/reorder/remove + denial. |

## Automated tests (all passing)

* `scripts/test-db.sh` — 103 SQL assertions: permissions, hierarchy, revocation, content isolation,
  messaging idempotency, push claim/retry/expiry, routing modes, installation secrets.
* `supabase/functions/_shared/dispatch-core.test.ts` — 6 tests: payload, ticket handling, outage, expiry.
* `mobile` — 5 tests: Darwin time formatting, tap de-duplication, seen-state persistence.
* Type checks: mobile and admin; admin ESLint; admin `next build`; mobile Android bundle export.

## Not yet done (next stages)

1. Create staging Supabase project + deploy (needs owner OK for the paid plan) → run U, V live.
2. Development builds on a real iPhone and Android phone → complete the device checklist below.
3. Owner content: logo/brand rules, PDFs, FlightAware + WillyWeather URLs, HR/SurveyMonkey links, contacts.
4. Store evidence (RELEASE.md) → decide update vs new listing.
5. End-to-end website tests (Playwright) once staging exists.

## Real-device verification checklist (results: not yet run)

| # | Step | iOS | Android |
|---|---|---|---|
| 1 | Fresh install: home shows only header, hamburger, logo | | |
| 2 | Larger text setting: menu labels wrap, nothing clipped; safe areas respected | | |
| 3 | Each menu item opens; back returns correctly (incl. Android back button) | | |
| 4 | Flight Tracker opens the airport page in-app; fallback button works offline | | |
| 5 | Weather widget renders with attribution, or URL fallback shows | | |
| 6 | Timetable, Village, Memorandum PDFs: scroll, zoom, multipage; missing/invalid file messages | | |
| 7 | Replace a PDF on the website → reopen in app shows new file (no stale copy) | | |
| 8 | Allow notifications → send departmental + global message → notification arrives with source as title | | |
| 9 | App in foreground when a push arrives → no banner, no pop-up, home unchanged | | |
| 10 | Tap notification (app killed / backgrounded) → opens that message once; back works | | |
| 11 | Resume / airplane-mode off → no message opens by itself | | |
| 12 | Messages list refreshes on open; >24h messages listed; seen dot clears only after opening | | |
| 13 | Deny notifications → everything else works; Settings explains how to enable | | |
| 14 | Departmental follow toggles (if 'subscribers' mode) change who is notified | | |
| 15 | Phone, map and form links hand off correctly | | |

## Known limitations

* Push delivery is best-effort (Apple/Google/Expo). The app cannot keep a notification on screen,
  override disabled notifications, or remove one already shown after 24 h.
* Reinstalling the app resets its anonymous id, subscriptions and seen-state.
* Content is public to anyone with the app or a file link.
* Orphaned uploads (file chosen but never published) remain in storage until a periodic cleanup is added.
* Anonymous registration has no rate limiting beyond Supabase's defaults.
* Android PDFs depend on the admin website being reachable (it hosts the viewer).
