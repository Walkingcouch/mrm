#!/usr/bin/env bash
# Rebuild the MRM app's web build for the showcase site (sample content only).
set -euo pipefail
cd "$(dirname "$0")/../../mobile"
unset EXPO_PUBLIC_SUPABASE_URL EXPO_PUBLIC_SUPABASE_ANON_KEY EXPO_PUBLIC_PDF_VIEWER_URL
rm -rf ../showcase/apps/mrm
WEB_BASE_URL=/apps/mrm npx expo export -p web --output-dir ../showcase/apps/mrm
echo "Exported to showcase/apps/mrm"
