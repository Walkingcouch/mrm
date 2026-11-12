# Release & store-update feasibility

**Nothing is published without the owner's separate release instruction.**

## Update the existing listings, or publish new ones?

Updating the existing listings keeps current users and reviews, but only works if the owner controls
the accounts and signing. This must be confirmed from real account evidence (acceptance T), not assumed.

| Check | Evidence needed | Status |
|---|---|---|
| Google Play: who owns the developer account for `io.appbuild.mcarthur`? | Play Console access screenshot | ❓ Public listing shows the developer as "BMA.Technology" (which also publishes other appbuild.io apps), so the account may belong to the builder rather than the mine |
| Android package name | Play Console → App → Dashboard | Public listing: `io.appbuild.mcarthur` — to verify in console |
| Play App Signing | Play Console → Test and release → App integrity | ❓ If Google manages the app signing key, a new upload key can be registered; if the builder holds the key, a transfer/reset is needed |
| Apple: who owns the App Store Connect account for app id6450782901? | App Store Connect access | ❓ |
| iOS bundle identifier | App Store Connect → App Information → Bundle ID | ❓ Not known — the store id `6450782901` is NOT a bundle id. Test builds use `dev.local.mrm.preview` (see docs/IOS.md) |
| Certificates / provisioning | Apple Developer → Certificates, Identifiers & Profiles | ❓ |
| Listing transfer (if accounts belong to the builder) | Apple "App Transfer" / Google "Transfer app" processes | ❓ |
| Push credentials | New APNs key + Firebase project for the package | To create under owner's accounts |

Decision rule:
* Owner controls both accounts + Play App Signing → ship as an **update** (same bundle/package, higher version).
* Accounts belong to the builder → request **app transfer** to the owner's accounts first, or publish a
  **new listing** and ask users to switch (old app keeps working until retired).

Existing push registrations, tokens and seen-state from the white-label app are not imported. Users
register again automatically the first time they open the new version.

## Build & test distribution

```bash
cd mobile
# staging (internal testers)
IOS_BUNDLE_ID=<verified> ANDROID_PACKAGE=<verified> npx eas-cli@latest build --profile staging --platform all
# production (only after release instruction)
npx eas-cli@latest build --profile production --platform all
npx eas-cli@latest submit --profile production --platform ios     # → TestFlight / App Store Connect
npx eas-cli@latest submit --profile production --platform android # → Play internal testing track
```

## Store submission checklist

* App name, description, screenshots (new UI), support URL/email, privacy policy URL (new — the
  old one is hosted by the builder at cms.appbuild.io).
* Privacy answers: no tracking, no analytics; collects only an anonymous installation id and push
  token (app functionality). Google Data safety and Apple privacy labels to match.
* Age rating questionnaire; export compliance (standard HTTPS only — `ITSAppUsesNonExemptEncryption=false`).
* Review notes: the app is a public information app for a mine site; no login.
