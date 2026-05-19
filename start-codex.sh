#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 20+ is required. Install it from https://nodejs.org/"
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

if [ ! -f "dist/index.cjs" ] || [ ! -f "dist/public/index.html" ]; then
  echo "Building application..."
  npm run build
fi

APP_HOST="127.0.0.1"
APP_PORT="${PORT:-5000}"
APP_URL="http://${APP_HOST}:${APP_PORT}/#/"

echo "Starting Codex Citation Desktop at ${APP_URL}"

if command -v open >/dev/null 2>&1; then
  (
    for i in {1..80}; do
      if curl -fsS "http://${APP_HOST}:${APP_PORT}/index.html" >/dev/null 2>&1; then
        open "$APP_URL"
        exit 0
      fi
      sleep 0.25
    done
    echo "Open manually: ${APP_URL}"
  ) &
fi

HOST="$APP_HOST" PORT="$APP_PORT" npm start
