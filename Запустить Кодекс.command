#!/bin/bash
set -e

cd "$(dirname "$0")"

clear
echo "========================================"
echo "  Кодекс Citation Desktop"
echo "========================================"
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js не найден."
  echo ""
  echo "1. Установите Node.js 20 LTS или новее:"
  echo "   https://nodejs.org/"
  echo ""
  echo "2. После установки снова дважды нажмите"
  echo "   «Запустить Кодекс.command»."
  echo ""
  read -p "Нажмите Enter, чтобы закрыть окно..."
  exit 1
fi

NODE_MAJOR=$(node -p "parseInt(process.versions.node.split('.')[0], 10)")
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "Установлена старая версия Node.js: $(node -v)"
  echo "Нужна Node.js 20 LTS или новее: https://nodejs.org/"
  echo ""
  read -p "Нажмите Enter, чтобы закрыть окно..."
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "Первый запуск: устанавливаю зависимости..."
  echo "Это может занять несколько минут."
  echo ""
  npm install
fi

if [ ! -f "dist/index.cjs" ] || [ ! -f "dist/public/index.html" ]; then
  echo ""
  echo "Собираю приложение..."
  npm run build
fi

APP_HOST="127.0.0.1"
APP_PORT="${PORT:-5000}"
APP_URL="http://${APP_HOST}:${APP_PORT}/#/"
HEALTH_URL="http://${APP_HOST}:${APP_PORT}/index.html"

echo ""
echo "Запускаю приложение..."
echo "Если браузер не открылся автоматически, откройте:"
echo "$APP_URL"
echo ""

(
  for i in {1..80}; do
    if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
      open "$APP_URL"
      exit 0
    fi
    sleep 0.25
  done

  echo ""
  echo "Браузер не открылся автоматически."
  echo "Откройте вручную: $APP_URL"
) &

HOST="$APP_HOST" PORT="$APP_PORT" npm start
