#!/usr/bin/env bash
# Rebuild the MRM app's web build for the showcase site. It connects to the
# live MRM backend (the same public settings as the phone preview builds, read
# from mobile/eas.json), so content, documents and messages are live.
# Set DEMO_SAMPLE=1 to build with built-in sample content instead.
set -euo pipefail
cd "$(dirname "$0")/../../mobile"
if [ "${DEMO_SAMPLE:-}" = "1" ]; then
  unset EXPO_PUBLIC_SUPABASE_URL EXPO_PUBLIC_SUPABASE_ANON_KEY EXPO_PUBLIC_PDF_VIEWER_URL
else
  eval "$(node -e '
    const e = require("./eas.json").build.preview.env;
    for (const k of ["EXPO_PUBLIC_SUPABASE_URL","EXPO_PUBLIC_SUPABASE_ANON_KEY","EXPO_PUBLIC_PDF_VIEWER_URL"])
      console.log(`export ${k}=${JSON.stringify(e[k])}`);
  ')"
fi
rm -rf ../showcase/apps/mrm
WEB_BASE_URL=/apps/mrm npx expo export -p web --output-dir ../showcase/apps/mrm
python3 ../showcase/scripts/fix-web-export.py ../showcase/apps/mrm "McArthur River Mine – App Demo"
echo "Exported to showcase/apps/mrm"
