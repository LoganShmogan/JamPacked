#!/usr/bin/env bash
# Build the web app, ship it to the server, start containers, push Convex functions.
# Usage: deploy/deploy.sh [ssh-host]   (default: loganserver)
# Needs locally: flutter, node/npm, rsync, ssh. Needs on server: docker compose, the shared Caddy proxy.
set -euo pipefail
HOST=${1:-loganserver}
DIR=foodsafe            # relative to the remote home directory
URL=https://foodsafety.savepoint.co.nz
TUNNEL_PORT=3299
ROOT=$(cd "$(dirname "$0")/.." && pwd)

echo "==> Building web app"
(cd "$ROOT/app" && flutter build web --release --dart-define=CONVEX_URL=$URL)

echo "==> Uploading"
ssh "$HOST" "mkdir -p $DIR/web"
rsync -az --delete "$ROOT/app/build/web/" "$HOST:$DIR/web/"
rsync -az "$ROOT/deploy/docker-compose.yml" "$ROOT/deploy/nginx.conf" "$HOST:$DIR/"

echo "==> Starting containers"
ssh "$HOST" bash -s <<REMOTE
set -euo pipefail
cd $DIR
docker compose up -d
until curl -sf http://127.0.0.1:3210/version >/dev/null; do sleep 2; done
[ -s .admin_key ] || docker compose exec -T convex ./generate_admin_key.sh | tail -1 > .admin_key
chmod 600 .admin_key

# Add the Caddy route once. Append (not sed -i) so the bind-mounted file keeps its inode.
if ! grep -q "foodsafety.savepoint.co.nz" ~/caddy/Caddyfile; then
  cp ~/caddy/Caddyfile ~/caddy/Caddyfile.bak-\$(date +%F-%H%M)
  printf '\nhttp://foodsafety.savepoint.co.nz {\n    reverse_proxy foodsafe:80\n}\n' >> ~/caddy/Caddyfile
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
