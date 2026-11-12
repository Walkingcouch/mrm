# iPhone (iOS) test builds

The app code is ready for iPhone. Building it needs an Apple Developer account,
because Apple only installs signed apps. Nothing here touches the live App Store
app: test builds use the separate bundle id `dev.local.mrm.preview` and install
as **MRM Preview** alongside the live app.

Expo project: `first-geospatial / mrm-mcarthur-river-mine`
(id `7ce70da8-8d9e-443d-89e7-e907dcdfbe10`).

## What is already done in the code

| Item | Value |
|---|---|
| Bundle id (preview) | `dev.local.mrm.preview` (override with `IOS_BUNDLE_ID`) |
| Bundle id (staging/production) | must be set with `IOS_BUNDLE_ID`; the build refuses to run without it |
| Build profile | `preview` in `mobile/eas.json`, internal (ad hoc) distribution |
| Push notifications | `expo-notifications` adds the Push capability automatically |
| Export compliance | `ITSAppUsesNonExemptEncryption = false` (no prompt in App Store Connect) |
| Dev client | `expo-dev-client` installed, for the `development` profile |

## What the owner needs (one time)

1. **Apple Developer account.** Use the one that owns the live app, or a separate
   one. Do not buy a new membership without the owner's go-ahead.
2. **Sign Expo in to Apple once.** A GitHub build can't sign in to Apple by
   itself, so the signing files must exist before the first iOS build. On any
   Mac or PC with Node.js, in the `mobile` folder run
   `npx eas-cli@latest credentials -p ios`, choose the `preview` profile and sign
   in with the Apple account when asked. Expo creates and stores the
   certificate, provisioning profile and push key; later builds reuse them.
   (Someone who already manages Apple certificates can instead upload a
   distribution certificate and ad hoc provisioning profile on
   expo.dev → Credentials → iOS.)
3. **Register the test iPhones** (ad hoc builds only run on registered phones).
   Run `npx eas-cli@latest device:create`, choose "Website", and send the link or
   QR code to each tester. They open it on their iPhone and install the small
   profile it offers. Re-run the credentials step after adding phones so the
   provisioning profile includes them.

## Building

- expo.dev → Builds → **Build from GitHub** → platform **iOS**, branch `main`,
  profile `preview`; or
- GitHub → Actions → **Expo build** → platform `ios` (needs the `EXPO_TOKEN` secret).

When it finishes, testers open the build page on their registered iPhone and tap
**Install**.

## Alternative: TestFlight

Testers don't need to be registered, but each build goes through a short Apple
review, and it needs an App Store Connect app record. Uploading to the **live**
app's record counts as a release step under the brief, so use a separate app
record (with its own bundle id) unless the owner instructs otherwise.

## Expo Go (no build)

Expo Go from the App Store runs a single SDK version. This app uses SDK 58; check
Expo Go → Settings on the iPhone. If it matches, run `npx expo start --tunnel` in
`mobile` on a computer and scan the QR code. Push notifications don't work in
Expo Go.
