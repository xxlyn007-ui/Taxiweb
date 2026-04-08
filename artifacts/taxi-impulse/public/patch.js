const fs = require('fs');
const path = require('path');

const ROOT = '/var/www/taxi-impulse';

// ===== PATCH orders.ts =====
const ordersPath = path.join(ROOT, 'artifacts/api-server/src/routes/orders.ts');
let orders = fs.readFileSync(ordersPath, 'utf8');

const yandexFn = `
async function yandexGeocode(address, apiKey) {
  try {
    const url = 'https://geocode-maps.yandex.ru/1.x/?apikey=' + apiKey + '&geocode=' + encodeURIComponent(address) + '&format=json&lang=ru_RU&results=1';
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();
    const pos = data?.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject?.Point?.pos;
    if (!pos) return null;
    const parts = pos.split(' ');
    const lon = parseFloat(parts[0]);
    const lat = parseFloat(parts[1]);
    if (!lon || !lat) return null;
    return { lon, lat };
  } catch { return null; }
}

async function nominatimGeocode(address) {
  try {
    const url = 'https://nominatim.openstreetmap.org/search?q=' + encodeURIComponent(address) + '&format=json&limit=1&accept-language=ru';
    const res = await fetch(url, { signal: AbortSignal.timeout(5000), headers: { 'User-Agent': 'TaxiImpulse/1.0' } });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.length) return null;
    return { lon: parseFloat(data[0].lon), lat: parseFloat(data[0].lat) };
  } catch { return null; }
}

`;

if (!orders.includes('yandexGeocode')) {
  orders = orders.replace('async function estimateDistance', yandexFn + 'async function estimateDistance');
  console.log('✓ Добавлены функции Яндекс и Nominatim геокодера');
} else {
  console.log('- Геокодер уже добавлен');
}

// Replace estimateDistance body to use Yandex first
const oldEstimate = /async function estimateDistance\([^)]+\)[^{]*\{[\s\S]*?\/\/ No geocoding.*?return estimateDistanceFallback[^;]+;(\s*}\s*\}?\s*async function)/m;

const newEstimateBody = `async function estimateDistance(fromAddr, toAddr, city, toCity) {
  const destCity = (toCity && toCity !== city) ? toCity : city;
  const isIntercity = toCity && toCity !== city;
  const yandexKey = process.env.YANDEX_API_KEY;
  const twogisKey = process.env.TWOGIS_API_KEY;
  try {
    const fromCenter = CITY_COORDS[city] ? { lat: CITY_COORDS[city][0], lon: CITY_COORDS[city][1] } : undefined;
    const toCenter = CITY_COORDS[destCity] ? { lat: CITY_COORDS[destCity][0], lon: CITY_COORDS[destCity][1] } : undefined;
    let fromCoords = null, toCoords = null;
    if (yandexKey) {
      [fromCoords, toCoords] = await Promise.all([
        yandexGeocode(\`\${city}, \${fromAddr}\`, yandexKey),
        yandexGeocode(\`\${destCity}, \${toAddr}\`, yandexKey),
      ]);
    }
    if ((!fromCoords || !toCoords) && twogisKey) {
      [fromCoords, toCoords] = await Promise.all([
        geocodeAddress(\`\${city}, \${fromAddr}\`, twogisKey, fromCenter),
        geocodeAddress(\`\${destCity}, \${toAddr}\`, twogisKey, toCenter),
      ]);
    }
    if (!fromCoords || !toCoords) {
      [fromCoords, toCoords] = await Promise.all([
        nominatimGeocode(\`\${city}, \${fromAddr}, Россия\`),
        nominatimGeocode(\`\${destCity}, \${toAddr}, Россия\`),
      ]);
    }
    if (fromCoords && toCoords) {
      const osrmKm = await osrmRoute(fromCoords.lon, fromCoords.lat, toCoords.lon, toCoords.lat);
      if (osrmKm !== null) return osrmKm;
      const straight = haversineKm(fromCoords.lat, fromCoords.lon, toCoords.lat, toCoords.lon);
      const factor = isIntercity ? 1.25 : 1.4;
      return Math.max(0.5, Math.round(straight * factor * 10) / 10);
    }
  } catch {}
  return estimateDistanceFallback(fromAddr, toAddr, city, toCity);
}

$1`;

if (!orders.includes('YANDEX_API_KEY')) {
  orders = orders.replace(oldEstimate, newEstimateBody);
  console.log('✓ Обновлена функция estimateDistance');
} else {
  console.log('- estimateDistance уже обновлена');
}

fs.writeFileSync(ordersPath, orders);
console.log('✓ orders.ts сохранён');

// ===== PATCH login.tsx =====
const loginPath = path.join(ROOT, 'artifacts/taxi-impulse/src/pages/login.tsx');
let login = fs.readFileSync(loginPath, 'utf8');

if (!login.includes('Условия использования')) {
  // Add terms button before last closing div
  login = login.replace(
    `          <div className="mt-6 text-center text-sm text-white/30">
            Нет аккаунта?`,
    `          <div className="mt-6 text-center text-sm text-white/30">
            Нет аккаунта?`
  );

  login = login.replace(
    '</div>\n\n        </div>\n      </div>\n    </div>\n  );\n}',
    `</div>

          <div className="mt-4 text-center">
            <button
              onClick={() => alert(\`УСЛОВИЯ ИСПОЛЬЗОВАНИЯ\\n\\nТАXI IMPULSE оказывает информационные услуги по организации поездок. Водители несут самостоятельную ответственность за качество перевозок.\\n\\nОплата производится напрямую водителю. Стоимость зависит от расстояния и тарифа.\\n\\nАдминистратор: @Work24m\\nДубровский Никита Владимирович, ИНН: 245611900291\`)}
              className="text-xs text-white/20 hover:text-white/40 transition-colors underline underline-offset-2"
            >
              Условия использования
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}`
  );
  console.log('✓ Добавлена ссылка на условия в login.tsx');
} else {
  console.log('- Условия уже добавлены');
}

fs.writeFileSync(loginPath, login);
console.log('✓ login.tsx сохранён');
console.log('\n✅ Патч применён! Теперь запустите:');
console.log('cd /var/www/taxi-impulse && BASE_PATH=/ PORT=3000 pnpm --filter @workspace/taxi-impulse run build && pm2 restart taxi-api && systemctl reload nginx');
