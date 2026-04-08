/**
 * Общий геокодер: Яндекс → 2GIS → Nominatim
 * Отслеживает лимит Яндекса и автоматически переключается
 */

const CITY_COORDS: Record<string, [number, number]> = {
  "Красноярск":    [56.010563, 92.852572],
  "Ачинск":        [56.267400, 90.500800],
  "Канск":         [56.203000, 95.717000],
  "Минусинск":     [53.705000, 91.689000],
  "Норильск":      [69.348000, 88.189000],
  "Лесосибирск":   [58.235000, 92.480000],
  "Шарыпово":      [55.533000, 89.172000],
  "Зеленогорск":   [56.115000, 93.533000],
  "Железногорск":  [56.251000, 93.532000],
  "Сосновоборск":  [56.116000, 93.338000],
  "Назарово":      [56.009000, 90.399000],
  "Дивногорск":    [55.961000, 91.374000],
  "Енисейск":      [58.454000, 92.164000],
  "Бородино":      [55.905000, 96.064000],
  "Игарка":        [67.473000, 86.573000],
  "Заозёрный":     [55.959000, 94.707000],
  "Кодинск":       [58.603000, 99.219000],
  "Уяр":           [55.814000, 96.051000],
  "Иланский":      [56.236000, 96.072000],
  "Козулька":      [56.011000, 89.881000],
  // Дополнительные города
  "Ужур":          [55.311900, 89.825600],
  "Абакан":        [53.721100, 91.442600],
  "Усть-Абакан":   [53.749000, 91.431000],
  "Балахта":       [55.374500, 91.622100],
  "Боготол":       [56.201000, 89.531000],
  "Березовка":     [56.142000, 92.907000],
  "Большая Мурта": [56.760000, 93.226000],
  "Большой Улуй":  [56.940000, 90.830000],
  "Дудинка":       [69.397000, 86.179000],
  "Емельяново":    [56.177000, 92.614000],
  "Партизанское":  [54.800000, 90.434000],
  "Сухобузимо":    [57.000000, 93.100000],
  "Тюхтет":        [56.528000, 89.352000],
};

export { CITY_COORDS };

// ---------- Общий лимит Яндекса (разделяется между geocode.ts и orders.ts) ----------
let yandexLimitHitAt: number | null = null;
const YANDEX_COOLDOWN_MS = 60 * 60 * 1000;

export function isYandexBlocked(): boolean {
  if (!yandexLimitHitAt) return false;
  if (Date.now() - yandexLimitHitAt > YANDEX_COOLDOWN_MS) {
    yandexLimitHitAt = null;
    return false;
  }
  return true;
}

export function markYandexLimited(): void {
  yandexLimitHitAt = Date.now();
  console.warn("[geocoder] Яндекс лимит исчерпан, переключаемся на 2GIS/Nominatim на 1 час");
}

export function getYandexLimitStatus() {
  return {
    blocked: isYandexBlocked(),
    limitedUntil: yandexLimitHitAt ? new Date(yandexLimitHitAt + YANDEX_COOLDOWN_MS).toISOString() : null,
  };
}

// ---------- Кэш геокодинга (TTL 6ч, max 2000 записей) ----------
const GEO_CACHE_TTL = 6 * 60 * 60 * 1000;
const geoCache = new Map<string, { coords: [number, number] | null; exp: number }>();

function cacheGet(key: string): [number, number] | null | undefined {
  const e = geoCache.get(key);
  if (!e) return undefined;
  if (Date.now() > e.exp) { geoCache.delete(key); return undefined; }
  return e.coords;
}

function cacheSet(key: string, coords: [number, number] | null): void {
  if (geoCache.size >= 2000) {
    const first = geoCache.keys().next().value;
    if (first !== undefined) geoCache.delete(first);
  }
  geoCache.set(key, { coords, exp: Date.now() + GEO_CACHE_TTL });
}

// ---------- Яндекс геокодер ----------
export async function yandexGeocode(q: string, apiKey: string, timeoutMs = 4000): Promise<[number, number] | "limited" | null> {
  if (isYandexBlocked()) return null;
  try {
    const url = `https://geocode-maps.yandex.ru/1.x/?apikey=${apiKey}&geocode=${encodeURIComponent(q)}&format=json&lang=ru_RU&results=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (res.status === 429 || res.status === 403) {
      markYandexLimited();
      return "limited";
    }
    if (!res.ok) return null;
    const data = await res.json() as any;
    const pos: string = data?.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject?.Point?.pos;
    if (!pos) return null;
    const [lon, lat] = pos.split(" ").map(parseFloat);
    if (!lon || !lat) return null;
    return [lat, lon];
  } catch {
    return null;
  }
}

// ---------- 2GIS геокодер ----------
export async function twogisGeocode(q: string, apiKey: string, cityCenter?: [number, number], timeoutMs = 5000): Promise<[number, number] | null> {
  try {
    const url = `https://catalog.api.2gis.com/3.0/items/geocode?q=${encodeURIComponent(q)}&fields=items.geometry.centroid&key=${apiKey}&results=5`;
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    const data = await res.json() as any;
    const items: any[] = data?.result?.items ?? [];
    if (!items.length) return null;

    let best: [number, number] | null = null;
    let bestDist = Infinity;

    for (const item of items) {
      const centroid: string = item?.geometry?.centroid;
      if (!centroid) continue;
      const m = centroid.match(/POINT\(([0-9.]+)\s+([0-9.]+)\)/);
      if (!m) continue;
      const lon = parseFloat(m[1]);
      const lat = parseFloat(m[2]);
      if (cityCenter) {
        const d = haversineKm(lat, lon, cityCenter[0], cityCenter[1]);
        if (d < bestDist) { bestDist = d; best = [lat, lon]; }
      } else {
        return [lat, lon];
      }
    }
    return best;
  } catch {
    return null;
  }
}

// ---------- Nominatim геокодер ----------
export async function nominatimGeocode(q: string, cityCenter?: [number, number], timeoutMs = 4000): Promise<[number, number] | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q + ", Россия")}&format=json&limit=5&accept-language=ru`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "User-Agent": "TaxiImpulse/1.0 (taxiimpulse.ru)" },
    });
    if (!res.ok) return null;
    const data = await res.json() as any[];
    if (!data?.length) return null;

    if (cityCenter && data.length > 1) {
      let best: [number, number] | null = null;
      let bestDist = Infinity;
      for (const item of data) {
        const lat = parseFloat(item.lat);
        const lon = parseFloat(item.lon);
        const d = haversineKm(lat, lon, cityCenter[0], cityCenter[1]);
        if (d < bestDist) { bestDist = d; best = [lat, lon]; }
      }
      return best;
    }
    return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
  } catch {
    return null;
  }
}

// ---------- Основная функция геокодинга: Яндекс → 2GIS → Nominatim ----------
export async function geocodeAddress(
  address: string,
  city: string,
  yandexKey?: string,
  twogisKey?: string,
): Promise<[number, number] | null> {
  const cacheKey = `${city}::${address}`;
  const cached = cacheGet(cacheKey);
  if (cached !== undefined) return cached;

  const cityCenter = CITY_COORDS[city];
  const fullQuery = city ? `${city}, ${address}` : address;

  // 1. Яндекс (самый точный для России)
  if (yandexKey && !isYandexBlocked()) {
    const result = await yandexGeocode(fullQuery, yandexKey, 4000);
    if (result && result !== "limited") {
      cacheSet(cacheKey, result);
      return result;
    }
  }

  // 2. 2GIS (отлично работает для российских городов)
  if (twogisKey) {
    const result = await twogisGeocode(fullQuery, twogisKey, cityCenter, 5000);
    if (result) {
      cacheSet(cacheKey, result);
      return result;
    }
  }

  // 3. Nominatim (OpenStreetMap, последний резерв)
  const nomResult = await nominatimGeocode(fullQuery, cityCenter, 4000);
  if (!nomResult) {
    console.warn(`[geocoder] Все геокодеры не нашли: "${fullQuery}"`);
  }
  cacheSet(cacheKey, nomResult);
  return nomResult;
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
