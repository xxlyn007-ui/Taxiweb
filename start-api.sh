#!/bin/bash
set -a

ENV_FILE="/var/www/taxi-impulse/artifacts/api-server/.env"
[ -f "$ENV_FILE" ] && source "$ENV_FILE"

export NODE_ENV=production
export PORT=8080
export YANDEX_API_KEY="0cb34d82-1882-4add-9645-fedb77532f0c"
export TWOGIS_API_KEY="2a7e10c0-891a-4738-9889-e6b6287274fa"
export VAPID_PUBLIC_KEY="BO7T5amIr4ZawEEpoMv15oXK9PomZNQR_wYROlqUrJSdeVLwSlpkidWa8OgzWG2p6yvrcPAiBUDeKPvaJ4fFwng"
export VAPID_PRIVATE_KEY="RRKSWBGNbYISD3QJt1A-AkQ7P0uf15GbbGP8Pzc-szs"
export VAPID_SUBJECT="mailto:admin@taxiimpulse.ru"

set +a

BASE="/var/www/taxi-impulse"
TSX=""

for p in \
  "$BASE/node_modules/.bin/tsx" \
  "$BASE/artifacts/api-server/node_modules/.bin/tsx" \
  "$(which tsx 2>/dev/null)" \
  "$(pnpm bin 2>/dev/null)/tsx"
do
  if [ -f "$p" ] && [ -x "$p" ]; then
    TSX="$p"
    break
  fi
done

if [ -z "$TSX" ]; then
  echo "[start-api] tsx not found, running pnpm install..."
  cd "$BASE" && pnpm install --frozen-lockfile 2>/dev/null || pnpm install
  TSX="$BASE/node_modules/.bin/tsx"
fi

echo "[start-api] Starting with: $TSX"
cd "$BASE/artifacts/api-server"
exec "$TSX" src/index.ts
