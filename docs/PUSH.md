# Android push notifications (Firebase / FCM V1)

iPhone push already works (Apple push key in EAS). Android needs Firebase:

1. **Firebase project**: console.firebase.google.com → Create a project
   (e.g. "MRM App"); Google Analytics not needed.
2. **Android app in Firebase**: Project overview → Add app → Android.
   Package name must match the build exactly:
   - preview builds: `dev.local.mrm.preview`
   - store build later: the real package name (add a second Android app then).
   Skip SHA-1. Register, download `google-services.json`, skip the SDK steps.
3. **google-services.json → repo**: save it as `mobile/google-services.json`
   and commit (it identifies the Firebase project; it is not a secret key).
   `app.config.ts` picks it up automatically (or set an EAS file variable
   `GOOGLE_SERVICES_JSON` instead of committing it).
4. **Service account key (SECRET)**: Firebase → Project settings → Service
   accounts → Generate new private key. Do not commit or share it.
5. **Upload to Expo**: expo.dev → first-geospatial → mrm-mcarthur-river-mine →
   Credentials → Android → `dev.local.mrm.preview` → FCM V1 service account
   key → upload the JSON. Then delete the downloaded key from your computer
   (Firebase can always issue a new one).
6. Check Firebase → Project settings → Cloud Messaging shows
   "Firebase Cloud Messaging API (V1)" as Enabled.
7. **New Android build** (preview profile), install, open the app and allow
   notifications. Send a test message from the admin website.
