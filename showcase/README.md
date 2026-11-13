# App showcase (demo website)

A public demo page that runs our apps inside iPhone and Android phone frames,
for sharing with potential customers. Each app runs as its **web build** (the
same app code, compiled for the browser). The MRM demo is connected to the
live backend (read-only, like the phone app): content, documents and messages
are live, and new messages appear as notification banners on the demo phones.
Browsers are never registered for real push.

A website can't run an `.apk` or iOS build directly; that would need a paid
cloud-emulator service. Android testers can still be offered the real `.apk`
through the optional download button.

## Add or update an app

1. Export the app's web build into `apps/<slug>/` (Expo apps):

   ```bash
   cd <app folder>            # e.g. mobile
   WEB_BASE_URL=/apps/<slug> npx expo export -p web --output-dir ../showcase/apps/<slug>
   ```

   Use the app's public backend settings for live content, or build without
   them (no `EXPO_PUBLIC_SUPABASE_*`) to use built-in sample content. The app's `app.config.ts` must pass
   `WEB_BASE_URL` through as `experiments.baseUrl` (see `mobile/app.config.ts`).

2. Add (or edit) its entry in `apps.json`:

   ```json
   { "slug": "<slug>", "name": "…", "tagline": "…", "description": "…",
     "features": ["…"], "path": "apps/<slug>/", "apk": "https://…/app.apk or null" }
   ```

3. Commit and push. Vercel redeploys the site automatically.

Link to a specific app with `?app=<slug>`, e.g. `/?app=mrm`.

## Re-export the MRM app

```bash
./showcase/scripts/export-mrm.sh
```
