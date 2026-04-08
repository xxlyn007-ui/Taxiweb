import { Router, type IRouter } from "express";

const router: IRouter = Router();

const COORDS: Record<string, [number, number]> = {
  "Красноярск":    [56.010563, 92.852572], "Ачинск":        [56.267400, 90.500800],
  "Канск":         [56.203000, 95.717000], "Минусинск":     [53.705000, 91.689000],
  "Норильск":      [69.348000, 88.189000], "Лесосибирск":   [58.235000, 92.480000],
  "Шарыпово":      [55.533000, 89.172000], "Зеленогорск":   [56.115000, 93.533000],
  "Железногорск":  [56.251000, 93.532000], "Сосновоборск":  [56.116000, 93.338000],
  "Назарово":      [56.009000, 90.399000], "Дивногорск":    [55.961000, 91.374000],
  "Кодинск":       [58.603000, 99.219000], "Ужур":          [55.311900, 89.825600],
  "Бородино":      [55.905000, 96.064000], "Игарка":        [67.473000, 86.573000],
  "Заозёрный":     [55.959000, 94.707000], "Уяр":           [55.814000, 96.051000],
  "Иланский":      [56.236000, 96.072000], "Козулька":      [56.011000, 89.881000],
  "Енисейск":      [58.454000, 92.164000], "Боготол":       [56.201000, 89.531000],
  "Балахта":       [55.374500, 91.622100], "Березовка":     [56.142000, 92.907000],
  "Большая Мурта": [56.760000, 93.226000], "Большой Улуй":  [56.940000, 90.830000],
  "Дудинка":       [69.397000, 86.179000], "Емельяново":    [56.177000, 92.614000],
  "Партизанское":  [54.800000, 90.434000], "Сухобузимо":    [57.000000, 93.100000],
  "Тюхтет":        [56.528000, 89.352000], "Усть-Абакан":   [53.749000, 91.431000],
  "Абакан":        [53.721100, 91.442600],
};

function hav(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

let _yAt: number | null = null;
function yBlocked(): boolean {
  if (_yAt === null) return false;
  if (Date.now() - _yAt > 3600000) { _yAt = null; return false; }
  return true;
}

async function tryYandex(q: string, cc?: [number, number]): Promise<[number, number] | null> {
  const key = process.env.YANDEX_API_KEY;
  if (!key || yBlocked()) return null;
  try {
    let url = "https://geocode-maps.yandex.ru/1.x/?apikey=" + key
      + "&geocode=" + encodeURIComponent(q) + "&format=json&lang=ru_RU&results=5";
    if (cc) url += "&ll=" + cc[1] + "," + cc[0] + "&spn=0.5,0.5&rspn=1";
    const r = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (r.status === 429 || r.status === 403) { _yAt = Date.now(); return null; }
    if (!r.ok) return null;
    const d = await r.json() as any;
    const members: any[] = d?.response?.GeoObjectCollection?.featureMember ?? [];
    if (!members.length) return null;
    if (cc && members.length > 1) {
      let best: [number, number] | null = null, bd = Infinity;
      for (const m of members) {
        const pos: string | undefined = m?.GeoObject?.Point?.pos;
        if (!pos) continue;
        const p = pos.split(" ");
        const lon = parseFloat(p[0]), lat = parseFloat(p[1]);
        if (isNaN(lat) || isNaN(lon)) continue;
        const dist = hav(lat, lon, cc[0], cc[1]);
        if (dist < bd) { bd = dist; best = [lat, lon]; }
      }
      return best;
    }
    const pos: string | undefined = members[0]?.GeoObject?.Point?.pos;
    if (!pos) return null;
    const p = pos.split(" ");
    const lon = parseFloat(p[0]), lat = parseFloat(p[1]);
    return isNaN(lat) || isNaN(lon) ? null : [lat, lon];
  } catch { return null; }
}

async function try2GIS(q: string, cc?: [number, number]): Promise<[number, number] | null> {
  const key = process.env.TWOGIS_API_KEY;
  if (!key) return null;
  try {
    const url = "https://catalog.api.2gis.com/3.0/items/geocode?q=" + encodeURIComponent(q)
      + "&fields=items.geometry.centroid&key=" + key + "&results=5";
    const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) return null;
    const d = await r.json() as any;
    const items: any[] = d?.result?.items ?? [];
    let best: [number, number] | null = null, bd = Infinity;
    for (const it of items) {
      const c: string = it?.geometry?.centroid ?? "";
      if (!c.startsWith("POINT(")) continue;
      const inner = c.slice(6, c.length - 1).split(" ");
      const lon = parseFloat(inner[0]), lat = parseFloat(inner[1]);
      if (isNaN(lat) || isNaN(lon)) continue;
      if (cc) { const d2 = hav(lat, lon, cc[0], cc[1]); if (d2 < bd) { bd = d2; best = [lat, lon]; } }
      else return [lat, lon];
    }
    return best;
  } catch { return null; }
}

async function tryNominatim(q: string, cc?: [number, number]): Promise<[number, number] | null> {
  try {
    const url = "https://nominatim.openstreetmap.org/search?q="
      + encodeURIComponent(q + ", Россия") + "&format=json&limit=5";
    const r = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: { "User-Agent": "TaxiImpulse/1.0 (taxiimpulse.ru)" },
    });
    if (!r.ok) return null;
    const d = await r.json() as any;
    if (!d?.length) return null;
    if (cc && d.length > 1) {
      let best: [number, number] | null = null, bd = Infinity;
      for (const it of d) {
        const lat = parseFloat(it.lat), lon = parseFloat(it.lon);
        const dist = hav(lat, lon, cc[0], cc[1]);
        if (dist < bd) { bd = dist; best = [lat, lon]; }
      }
      return best;
    }
    return [parseFloat(d[0].lat), parseFloat(d[0].lon)];
  } catch { return null; }
}

router.get("/geocode", async (req, res): Promise<void> => {
  const q = (req.query.q as string | undefined)?.trim();
  const city = (req.query.city as string | undefined)?.trim() || undefined;
  if (!q) { res.status(400).json({ error: "q обязателен" }); return; }
  const fullQ = city ? city + ", " + q : q;
  const cc = city ? COORDS[city] : undefined;
  const result = await tryYandex(fullQ, cc) ?? await try2GIS(fullQ, cc) ?? await tryNominatim(fullQ, cc);
  if (result) res.json({ lat: result[0], lon: result[1] });
  else res.status(404).json({ error: "Адрес не найден" });
});

router.get("/reverse-geocode", async (req, res): Promise<void> => {
  const lat = parseFloat(req.query.lat as string);
  const lon = parseFloat(req.query.lon as string);
  if (isNaN(lat) || isNaN(lon)) { res.status(400).json({ error: "lat и lon обязательны" }); return; }
  const key = process.env.YANDEX_API_KEY;
  if (key && !yBlocked()) {
    try {
      const url = "https://geocode-maps.yandex.ru/1.x/?apikey=" + key
        + "&geocode=" + lon + "," + lat + "&format=json&lang=ru_RU&results=1&kind=house";
      const r = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (r.status === 429 || r.status === 403) _yAt = Date.now();
      else if (r.ok) {
        const d = await r.json() as any;
        const obj = d?.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject;
        if (obj) {
          const addr = [obj.name ?? "", (obj.description ?? "").split(",")[0]].filter(Boolean).join(", ");
          if (addr) { res.json({ address: addr }); return; }
        }
      }
    } catch {}
  }
  try {
    const url = "https://nominatim.openstreetmap.org/reverse?lat=" + lat + "&lon=" + lon
      + "&format=json&zoom=18&addressdetails=1";
    const r = await fetch(url, {
      headers: { "User-Agent": "TaxiImpulse/1.0 (taxiimpulse.ru)" },
      signal: AbortSignal.timeout(5000),
    });
    if (r.ok) {
      const d = await r.json() as any;
      const a = d?.address;
      if (a) {
        const street = a.road ?? a.pedestrian ?? a.suburb ?? "";
        const house = a.house_number ?? "";
        const addr = street && house ? street + ", " + house
          : street || (d.display_name?.split(",")[0] ?? "");
        if (addr) { res.json({ address: addr }); return; }
      }
    }
  } catch {}
  res.status(404).json({ error: "Адрес не найден" });
});

router.get("/geocode/status", (_req, res): void => {
  res.json({ blocked: yBlocked(), yandexKey: !!process.env.YANDEX_API_KEY, twogisKey: !!process.env.TWOGIS_API_KEY });
});

async function tryOsrmRoute(fromLon: number, fromLat: number, toLon: number, toLat: number): Promise<[number, number][] | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${fromLon},${fromLat};${toLon},${toLat}?overview=full&geometries=geojson`;
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const d = await r.json() as any;
    const coords: [number, number][] | undefined = d?.routes?.[0]?.geometry?.coordinates;
    if (!coords?.length) return null;
    return coords.map(([lon2, lat2]: [number, number]) => [lat2, lon2]);
  } catch { return null; }
}

async function try2GISRoute(fromLon: number, fromLat: number, toLon: number, toLat: number): Promise<[number, number][] | null> {
  const key = process.env.TWOGIS_API_KEY;
  if (!key) return null;
  try {
    const url = `https://routing.api.2gis.com/routing/7.0.0/global?key=${key}`;
    const body = {
      locale: "ru",
      type: "car",
      waypoints: [{ x: fromLon, y: fromLat }, { x: toLon, y: toLat }],
      output: "routes",
    };
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const d = await r.json() as any;
    const steps = d?.result?.[0]?.legs?.[0]?.steps as any[] | undefined;
    if (!steps?.length) return null;
    const pts: [number, number][] = [];
    for (const step of steps) {
      const polyline: any[] = step?.polyline?.points ?? step?.points ?? [];
      for (const p of polyline) {
        if (typeof p.x === "number" && typeof p.y === "number") pts.push([p.y, p.x]);
      }
    }
    return pts.length > 1 ? pts : null;
  } catch { return null; }
}

router.get("/route", async (req, res): Promise<void> => {
  const fromLat = parseFloat(req.query.fromLat as string);
  const fromLon = parseFloat(req.query.fromLon as string);
  const toLat   = parseFloat(req.query.toLat as string);
  const toLon   = parseFloat(req.query.toLon as string);
  if ([fromLat, fromLon, toLat, toLon].some(isNaN)) {
    res.status(400).json({ error: "fromLat/fromLon/toLat/toLon обязательны" }); return;
  }
  const route = await try2GISRoute(fromLon, fromLat, toLon, toLat) ?? await tryOsrmRoute(fromLon, fromLat, toLon, toLat);
  if (route && route.length > 1) {
    const distKm = route.reduce((acc, pt, i) => {
      if (i === 0) return 0;
      return acc + hav(route[i - 1][0], route[i - 1][1], pt[0], pt[1]);
    }, 0);
    res.json({ points: route, distanceKm: Math.round(distKm * 10) / 10 });
    return;
  }
  res.status(503).json({ error: "Маршрут не найден" });
});

export default router;
