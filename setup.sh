#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

print() { echo -e "${GREEN}[✓]${NC} $1"; }
info()  { echo -e "${BLUE}[→]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

echo ""
echo "======================================================"
echo "   TAXI IMPULSE — Установка"
echo "======================================================"
echo ""

read -p "  Введите ваш домен (например: taxiimpulse.ru): " DOMAIN
read -p "  Придумайте пароль для базы данных: " DB_PASS
echo ""

info "Обновляем систему..."
apt-get update -qq && apt-get upgrade -y -qq
print "Система обновлена"

if ! command -v node &>/dev/null; then
  info "Устанавливаем Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
print "Node.js $(node --version)"

if ! command -v pnpm &>/dev/null; then
  info "Устанавливаем pnpm..."
  npm install -g pnpm --quiet
fi
print "pnpm $(pnpm --version)"

if ! command -v pm2 &>/dev/null; then
  npm install -g pm2 --quiet
fi
print "PM2 установлен"

if ! command -v nginx &>/dev/null; then
  apt-get install -y nginx
fi
print "Nginx установлен"

if ! command -v certbot &>/dev/null; then
  apt-get install -y certbot python3-certbot-nginx
fi
print "Certbot установлен"

if ! command -v psql &>/dev/null; then
  apt-get install -y postgresql postgresql-contrib
fi
systemctl start postgresql
print "PostgreSQL установлен"

info "Создаём базу данных..."
sudo -u postgres psql -c "DROP DATABASE IF EXISTS taxi_impulse;" -q 2>/dev/null || true
sudo -u postgres psql -c "DROP USER IF EXISTS taxi_user;" -q 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE taxi_impulse;" -q
sudo -u postgres psql -c "CREATE USER taxi_user WITH PASSWORD '$DB_PASS';" -q
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE taxi_impulse TO taxi_user;" -q
sudo -u postgres psql -c "ALTER DATABASE taxi_impulse OWNER TO taxi_user;" -q
print "База данных создана"

info "Создаём файл настроек..."
cat > /var/www/taxi-impulse/artifacts/api-server/.env << EOF
DATABASE_URL=postgresql://taxi_user:${DB_PASS}@localhost:5432/taxi_impulse
NODE_ENV=production
PORT=8080
EOF
print "Настройки сохранены"

info "Устанавливаем зависимости (3-5 минут)..."
cd /var/www/taxi-impulse
pnpm install --silent
print "Зависимости установлены"

info "Применяем схему базы данных..."
cd /var/www/taxi-impulse
pnpm --filter @workspace/db run push --accept-data-loss 2>/dev/null || pnpm --filter @workspace/db run push
print "Схема применена"

info "Добавляем начальные данные..."
pnpm --filter @workspace/api-server exec tsx src/seed.ts 2>/dev/null || true
print "Данные добавлены"

info "Собираем сайт (1-3 минуты)..."
pnpm --filter @workspace/taxi-impulse run build
print "Сайт собран"

info "Запускаем API сервер..."
pm2 delete taxi-api 2>/dev/null || true
pm2 start /var/www/taxi-impulse/ecosystem.config.cjs
pm2 save
print "API сервер запущен"

info "Настраиваем Nginx..."
cat > /etc/nginx/sites-available/taxi-impulse << NGINX
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};

    root /var/www/taxi-impulse/artifacts/taxi-impulse/dist;
    index index.html;
    client_max_body_size 10M;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;

    location /api/ {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
    }

    location /sw.js {
        add_header Cache-Control "no-cache";
    }

    location ~* \.(js|css|png|jpg|svg|webmanifest|ico)$ {
        expires 7d;
        add_header Cache-Control "public, immutable";
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
NGINX

rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
ln -sf /etc/nginx/sites-available/taxi-impulse /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
print "Nginx настроен"

info "Получаем SSL сертификат..."
certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos \
  --email "admin@${DOMAIN}" --redirect
print "SSL установлен"

pm2 startup systemd -u root --hp /root | tail -1 | bash
pm2 save

echo ""
echo "======================================================"
echo -e "  ${GREEN}ГОТОВО! Сайт запущен.${NC}"
echo "======================================================"
echo ""
echo -e "  Сайт:     ${BLUE}https://${DOMAIN}${NC}"
echo -e "  Админка:  ${BLUE}https://${DOMAIN}/login?admin=1${NC}"
echo -e "  Телефон:  ${YELLOW}89237720974${NC}"
echo -e "  Пароль:   ${YELLOW}TaxiImpuls26${NC}"
echo ""
echo "  Команды управления:"
echo "  pm2 status           — проверить состояние"
echo "  pm2 logs taxi-api    — посмотреть логи"
echo "  pm2 restart taxi-api — перезапустить"
echo ""
