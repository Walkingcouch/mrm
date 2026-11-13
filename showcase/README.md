# App showcase (demo website)

A public demo page that runs our apps inside iPhone and Android phone frames,
for sharing with potential customers. Each app runs as its **web build** (the
same app code, compiled for the browser), using sample content: no logins,
no real data, nothing sent to a backend.

A website can't run an `.apk` or iOS build directly; that would need a paid
cloud-emulator service. Android testers can still be offered the real `.apk`
through the optional download button.

## Add or update an app

1. Export the app's web build into `apps/<slug>/` (Expo apps):

   ```bash
   cd <app folder>            # e.g. mobile
   WEB_BASE_URL=/apps/<slug> npx expo export -p web --output-dir ../showcase/apps/<slug>
   ```

   Build **without** backend keys (no `EXPO_PUBLIC_SUPABASE_*`), so the app
   runs on its built-in sample content. The app's `app.config.ts` must pass
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
