#!/usr/bin/env bash
# Push the Convex functions to production, build the web app and the website against it, and upload both
# to Cloudflare Pages. Usage: deploy/deploy.sh
# Needs flutter and node/npm, and in the environment: CONVEX_DEPLOY_KEY (production deploy key),
# CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID. Setup: docs/DOCUMENTATION.md §14.
set -euo pipefail
: "${CONVEX_DEPLOY_KEY:?}" "${CLOUDFLARE_API_TOKEN:?}" "${CLOUDFLARE_ACCOUNT_ID:?}"
URL=https://adjoining-alligator-324.ap-southeast-2.convex.cloud   # production, Sydney
ROOT=$(cd "$(dirname "$0")/.." && pwd)
VERSION=$(sed -n 's/^version: //p' "$ROOT/app/pubspec.yaml")   # e.g. 0.1.0+2 (scripts/prepare-release.sh)
WRANGLER="npx --yes wrangler@4.168.0"

echo "==> Deploying JamPacked $VERSION"
# Functions first, so the new builds never call a function production doesn't have yet.
# npm ci: the Convex CLI from the lockfile, not whatever npx would fetch.
echo "==> Pushing Convex functions"
(cd "$ROOT/backend" && npm ci && npx convex deploy -y)

echo "==> Building web app"
rm -rf "$ROOT/app/build/web"   # flutter build web leaves files from earlier builds behind
(cd "$ROOT/app" && flutter build web --release --dart-define=CONVEX_URL=$URL)
echo "==> Building website"
(cd "$ROOT/web" && npm ci && NEXT_PUBLIC_CONVEX_URL=$URL npm run build)

# --branch main: a production deployment (the projects' production branch), live straight away.
echo "==> Uploading to Cloudflare Pages"
$WRANGLER pages deploy "$ROOT/app/build/web" --project-name jampacked-app --branch main --commit-dirty=true
$WRANGLER pages deploy "$ROOT/web/out" --project-name jampacked-site --branch main --commit-dirty=true

echo "==> Done: JamPacked $VERSION on https://app.jampacked.co.nz and https://jampacked.co.nz"
