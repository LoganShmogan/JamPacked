#!/usr/bin/env bash
# Build the web app, ship it to the server, start containers, push Convex functions.
# Usage: deploy/deploy.sh [ssh-host]   (default: loganserver)
# Needs locally: flutter, node/npm, rsync, ssh. Needs on server: docker compose, the shared Caddy proxy.
set -euo pipefail
HOST=${1:-loganserver}
DIR=foodsafe            # relative to the remote home directory
DOMAIN=jampacked.co.nz
URL=https://app.$DOMAIN
OLD_HOST=foodsafety.savepoint.co.nz   # previous address, now redirects to the new one
TUNNEL_PORT=3299
ROOT=$(cd "$(dirname "$0")/.." && pwd)

echo "==> Building web app"
(cd "$ROOT/app" && flutter build web --release --dart-define=CONVEX_URL=$URL)

# Fingerprint the app's entry scripts. Their names never change between builds, so Cloudflare and
# browsers would keep serving the old app; a new name per build means a deploy shows up straight away.
WEB="$ROOT/app/build/web"
MAIN=main.dart.$(sha256sum "$WEB/main.dart.js" | cut -c1-12).js
mv "$WEB/main.dart.js" "$WEB/$MAIN"
grep -q '"mainJsPath":"main.dart.js"' "$WEB/flutter_bootstrap.js"   # fails the deploy if Flutter changes this
sed -i "s/\"mainJsPath\":\"main.dart.js\"/\"mainJsPath\":\"$MAIN\"/" "$WEB/flutter_bootstrap.js"
BOOT=flutter_bootstrap.$(sha256sum "$WEB/flutter_bootstrap.js" | cut -c1-12).js
mv "$WEB/flutter_bootstrap.js" "$WEB/$BOOT"
sed -i "s/src=\"flutter_bootstrap.js\"/src=\"$BOOT\"/" "$WEB/index.html"
grep -q "src=\"$BOOT\"" "$WEB/index.html"
# Version the icons and manifest the same way (?v=content hash), so a new logo shows up straight away.
# manifest.json goes last: its own hash must include the icon versions written into it.
for f in favicon.png icons/Icon-192.png icons/Icon-512.png icons/Icon-maskable-192.png icons/Icon-maskable-512.png manifest.json; do
  V=$(sha256sum "$WEB/$f" | cut -c1-8)
  sed -i "s#\"$f\"#\"$f?v=$V\"#g" "$WEB/index.html" "$WEB/manifest.json"
done

echo "==> Uploading"
ssh "$HOST" "mkdir -p $DIR/web"
rsync -az --delete "$ROOT/app/build/web/" "$HOST:$DIR/web/"
rsync -az "$ROOT/deploy/docker-compose.yml" "$ROOT/deploy/nginx.conf" "$HOST:$DIR/"

echo "==> Starting containers"
ssh "$HOST" bash -s <<REMOTE
set -euo pipefail
cd $DIR
docker compose up -d
docker compose restart web   # pick up a new nginx.conf (rsync replaces the bind-mounted file)
until curl -sf http://127.0.0.1:3210/version >/dev/null; do sleep 2; done
[ -s .admin_key ] || docker compose exec -T convex ./generate_admin_key.sh | tail -1 > .admin_key
chmod 600 .admin_key

# Add the Caddy routes once: the app on app.$DOMAIN, the bare domain and www redirect to it until the
# website exists, and the old address redirects too. Write in place (append / cat >, not sed -i) so the
# bind-mounted file keeps its inode.
if ! grep -q "app.$DOMAIN" ~/caddy/Caddyfile; then
  cp ~/caddy/Caddyfile ~/caddy/Caddyfile.bak-\$(date +%F-%H%M)
  awk '/$OLD_HOST/{f=1} f && /reverse_proxy foodsafe:80/{sub(/reverse_proxy foodsafe:80/, "redir $URL{uri}"); f=0} {print}' \
    ~/caddy/Caddyfile > /tmp/Caddyfile.new && cat /tmp/Caddyfile.new > ~/caddy/Caddyfile && rm /tmp/Caddyfile.new
  printf '\nhttp://app.$DOMAIN {\n    reverse_proxy foodsafe:80\n}\n\nhttp://$DOMAIN, http://www.$DOMAIN {\n    redir $URL{uri}\n}\n' >> ~/caddy/Caddyfile
  docker exec caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
fi
REMOTE

echo "==> Pushing Convex functions (via SSH tunnel)"
ADMIN_KEY=$(ssh "$HOST" "cat $DIR/.admin_key")
ssh -fN -o ExitOnForwardFailure=yes -L $TUNNEL_PORT:127.0.0.1:3210 "$HOST"
trap 'pkill -f "ssh -fN -o ExitOnForwardFailure=yes -L $TUNNEL_PORT" || true' EXIT
(cd "$ROOT/backend" && CONVEX_DEPLOYMENT= CONVEX_SELF_HOSTED_URL=http://127.0.0.1:$TUNNEL_PORT \
  CONVEX_SELF_HOSTED_ADMIN_KEY="$ADMIN_KEY" npx convex deploy -y)

echo "==> Done: $URL"
