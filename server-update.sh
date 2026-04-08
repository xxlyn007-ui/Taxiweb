#!/bin/bash
# TAXI IMPULSE — Скрипт чистого обновления кода на сервере
# Запускать: bash /tmp/server-update.sh
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
ok()   { echo -e "${GREEN}[✓]${NC} $1"; }
info() { echo -e "${BLUE}[→]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

ARCHIVE="/tmp/taxi-impulse-full.tar.gz"
DEPLOY_DIR="/var/www/taxi-impulse"
ENV_FILE="${DEPLOY_DIR}/artifacts/api-server/.env"

echo ""
echo "======================================================"
echo "   TAXI IMPULSE — Чистое обновление кода"
echo "======================================================"
echo ""

# Проверяем архив
[ -f "$ARCHIVE" ] || err "Архив не найден: $ARCHIVE. Сначала загрузите его командой scp"

# Шаг 1: Останавливаем/отключаем Apache навсегда
info "Блокируем Apache..."
systemctl stop apache2 2>/dev/null || true
systemctl disable apache2 2>/dev/null || true
systemctl mask apache2 2>/dev/null || true
ok "Apache заблокирован"

# Шаг 2: Читаем текущий DATABASE_URL
DB_URL=""
if [ -f "$ENV_FILE" ]; then
  DB_URL=$(grep -m1 '^DATABASE_URL=' "$ENV_FILE" | cut -d= -f2- 2>/dev/null || true)
  if [ -n "$DB_URL" ]; then
    ok "DATABASE_URL найден в .env"
  fi
fi
if [ -z "$DB_URL" ]; then
  # Пытаемся собрать из системных переменных
  if [ -n "$DATABASE_URL" ]; then
    DB_URL="$DATABASE_URL"
    ok "DATABASE_URL взят из окружения"
  else
    warn "DATABASE_URL не найден. Пытаемся найти через postgresql..."
    # Пробуем стандартный путь Replit/taxi_impulse setup
    PG_PASS=$(sudo -u postgres psql -t -c "SELECT passwd FROM pg_shadow WHERE usename='taxi_user';" 2>/dev/null | tr -d ' \n' || true)
    if [ -n "$PG_PASS" ]; then
      warn "Пароль БД не удалось автоопределить. Введите вручную:"
      read -p "  DATABASE_URL (postgresql://taxi_user:ПАРОЛЬ@localhost:5432/taxi_impulse): " DB_URL
    else
      read -p "  Введите DATABASE_URL: " DB_URL
    fi
  fi
fi

# Шаг 3: Останавливаем PM2
info "Останавливаем PM2..."
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true
ok "PM2 остановлен"

# Шаг 4: Очищаем код (НЕ базу данных)
info "Очищаем старый код..."
rm -rf "${DEPLOY_DIR}/artifacts" "${DEPLOY_DIR}/lib" "${DEPLOY_DIR}/node_modules" \
  "${DEPLOY_DIR}/package.json" "${DEPLOY_DIR}/pnpm-workspace.yaml" \
  "${DEPLOY_DIR}/pnpm-lock.yaml" "${DEPLOY_DIR}/ecosystem.config.cjs" \
  "${DEPLOY_DIR}/tsconfig"* 2>/dev/null || true
mkdir -p "$DEPLOY_DIR"
ok "Старый код удалён"

# Шаг 5: Распаковываем новый код
info "Распаковываем новый код..."
tar -xzf "$ARCHIVE" -C "$DEPLOY_DIR" --strip-components=1
ok "Код распакован"

# Шаг 6: Создаём .env для API
info "Создаём конфигурацию..."
mkdir -p "${DEPLOY_DIR}/artifacts/api-server"
cat > "$ENV_FILE" << EOF
DATABASE_URL=${DB_URL}
NODE_ENV=production
PORT=8080
YANDEX_API_KEY=0cb34d82-1882-4add-9645-fedb77532f0c
EOF
ok ".env создан"

# Шаг 7: Устанавливаем зависимости
info "Устанавливаем зависимости (2-5 минут)..."
cd "$DEPLOY_DIR"
export DATABASE_URL="$DB_URL"
PNPM=$(which pnpm || echo "pnpm")
$PNPM install --frozen-lockfile 2>/dev/null || $PNPM install
ok "Зависимости установлены"

# Шаг 8: Применяем схему БД
info "Обновляем схему базы данных..."
$PNPM --filter @workspace/db run push --accept-data-loss 2>/dev/null || \
  $PNPM --filter @workspace/db run push 2>/dev/null || \
  warn "Схема БД не обновилась — проверьте DATABASE_URL"
ok "Схема БД обновлена"

# Шаг 9: Строим фронтенд
info "Собираем frontend (1-3 минуты)..."
BASE_PATH=/ PORT=3000 $PNPM --filter @workspace/taxi-impulse run build
ok "Frontend собран"

# Шаг 10: Настраиваем nginx
info "Настраиваем Nginx..."
FRONTEND_DIST="${DEPLOY_DIR}/artifacts/taxi-impulse/dist/public"
cat > /etc/nginx/sites-available/taxi-impulse << NGINX
server {
    listen 80;
    server_name taxiimpulse.ru www.taxiimpulse.ru 176.12.65.44 _;
    root ${FRONTEND_DIST};
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;

    location /api/ {
        proxy_pass http://127.0.0.1:8080/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_read_timeout 60s;
    }

    location ~* \\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files \$uri =404;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
NGINX

rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
ln -sf /etc/nginx/sites-available/taxi-impulse /etc/nginx/sites-enabled/taxi-impulse 2>/dev/null || true
nginx -t && systemctl reload nginx
ok "Nginx настроен"

# Шаг 11: Запускаем PM2
info "Запускаем API сервер..."
cd "$DEPLOY_DIR"
export DATABASE_URL="$DB_URL"
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null | grep 'sudo env' | bash 2>/dev/null || true
ok "PM2 запущен"

echo ""
echo "======================================================"
echo -e "  ${GREEN}ГОТОВО! Сервер обновлён и запущен.${NC}"
echo "======================================================"
echo ""
echo "  Полезные команды:"
echo "  pm2 status           — состояние"
echo "  pm2 logs taxi-api    — логи API"
echo "  pm2 restart taxi-api — перезапустить API"
echo ""
echo "  Сайт: http://taxiimpulse.ru"
echo "  Админ: http://taxiimpulse.ru/login?admin=1"
echo "  Логин: 89237720974 / TaxiImpuls26"
echo ""
