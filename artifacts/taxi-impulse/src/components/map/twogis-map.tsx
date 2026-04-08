import { useEffect, useRef, useState } from "react";
import { MapPin, Loader2 } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const CITY_CENTERS: Record<string, [number, number]> = {
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
  "Ужур":          [55.311900, 89.825600],
  "Абакан":        [53.721100, 91.442600],
  "Ачинский":      [56.267400, 90.500800],
  "Балахта":       [55.374500, 91.622100],
  "Березовка":     [56.142000, 92.907000],
  "Большая Мурта": [56.760000, 93.226000],
  "Большой Улуй":  [56.940000, 90.830000],
  "Боготол":       [56.201000, 89.531000],
  "Дудинка":       [69.397000, 86.179000],
  "Емельяново":    [56.177000, 92.614000],
  "Манск":         [55.834000, 93.498000],
  "Минусинский":   [53.705000, 91.689000],
  "Партизанское":  [54.800000, 90.434000],
  "Сухобузимо":    [57.000000, 93.100000],
  "Тюхтет":        [56.528000, 89.352000],
  "Усть-Абакан":   [53.749000, 91.431000],
};

function makeIcon(color: string, label: string): L.DivIcon {
  return L.divIcon({
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 36 48" style="filter:drop-shadow(0 2px 6px rgba(0,0,0,0.35))">
      <path d="M18 1C8.611 1 1 8.611 1 18c0 5.188 2.188 9.852 5.688 13.145L18 47l11.312-15.855C32.812 27.852 35 23.188 35 18 35 8.611 27.389 1 18 1z" fill="${color}"/>
      <circle cx="18" cy="18" r="10" fill="rgba(255,255,255,0.25)"/>
      <text x="18" y="23" font-family="system-ui,sans-serif" font-size="13" font-weight="800" fill="white" text-anchor="middle">${label}</text>
    </svg>`,
    iconSize: [36, 48],
    iconAnchor: [18, 48],
    className: "",
  });
}

function makeCarIcon(): L.DivIcon {
  return L.divIcon({
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40" style="filter:drop-shadow(0 2px 5px rgba(0,0,0,0.3))">
      <circle cx="20" cy="20" r="18" fill="#f59e0b"/>
      <g transform="translate(9,10)">
        <path fill="white" d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
      </g>
    </svg>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    className: "",
  });
}

const geocodeCache = new Map<string, [number, number] | null>();
async function geocodeApi(address: string, city: string): Promise<[number, number] | null> {
  const key = `${city}::${address}`;
  if (geocodeCache.has(key)) return geocodeCache.get(key)!;
  try {
    const url = `${BASE}/api/geocode?q=${encodeURIComponent(address)}&city=${encodeURIComponent(city)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) { geocodeCache.set(key, null); return null; }
    const data = await res.json() as { lat: number; lon: number };
    if (typeof data.lat !== "number") { geocodeCache.set(key, null); return null; }
    const coords: [number, number] = [data.lat, data.lon];
    geocodeCache.set(key, coords);
    return coords;
  } catch { return null; }
}

const routeCache = new Map<string, [number, number][]>();
async function getRoute(fromLat: number, fromLon: number, toLat: number, toLon: number): Promise<[number, number][] | null> {
  const cacheKey = `${fromLat.toFixed(4)},${fromLon.toFixed(4)};${toLat.toFixed(4)},${toLon.toFixed(4)}`;
  if (routeCache.has(cacheKey)) return routeCache.get(cacheKey)!;
  try {
    const url = `${BASE}/api/route?fromLat=${fromLat}&fromLon=${fromLon}&toLat=${toLat}&toLon=${toLon}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) return null;
    const data = await res.json() as { points: [number, number][]; distanceKm: number };
    if (data?.points?.length > 1) { routeCache.set(cacheKey, data.points); return data.points; }
    return null;
  } catch { return null; }
}

interface Props {
  city: string;
  toCity?: string;
  fromAddress?: string;
  toAddress?: string;
  driverCoords?: [number, number] | null;
  className?: string;
  height?: number;
}

export function TwoGisMap({ city, toCity, fromAddress, toAddress, driverCoords, className, height = 220 }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const fromMarkerRef = useRef<L.Marker | null>(null);
  const toMarkerRef = useRef<L.Marker | null>(null);
  const driverMarkerRef = useRef<L.Marker | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const routePtsRef = useRef<{ from: [number, number] | null; to: [number, number] | null }>({ from: null, to: null });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!mapRef.current) return;
    const knownCenter = CITY_CENTERS[city];
    const initialCenter: [number, number] = knownCenter ?? [56.010563, 92.852572];
    const map = L.map(mapRef.current, { zoomControl: true, attributionControl: false });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
    map.setView(initialCenter, 12);
    mapInstanceRef.current = map;

    if (!knownCenter) {
      geocodeApi(city + ", Красноярский край", "").then(coords => {
        if (coords && mapInstanceRef.current === map) {
          map.setView(coords, 12);
        }
      });
    }

    return () => {
      try { map.remove(); } catch {}
      mapInstanceRef.current = null;
      fromMarkerRef.current = null;
      toMarkerRef.current = null;
      driverMarkerRef.current = null;
      routeLayerRef.current = null;
    };
  }, [city]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const clear = () => {
      fromMarkerRef.current?.remove(); fromMarkerRef.current = null;
      toMarkerRef.current?.remove(); toMarkerRef.current = null;
      routeLayerRef.current?.remove(); routeLayerRef.current = null;
      routePtsRef.current = { from: null, to: null };
    };

    if (!fromAddress || !toAddress) { clear(); return; }
    clear();

    let cancelled = false;
    setLoading(true);

    (async () => {
      const destCity = toCity || city;
      const [fromCoords, toCoords] = await Promise.all([
        geocodeApi(fromAddress, city),
        geocodeApi(toAddress, destCity),
      ]);
      if (cancelled) return;
      setLoading(false);
      routePtsRef.current = { from: fromCoords, to: toCoords };

      if (fromCoords) fromMarkerRef.current = L.marker(fromCoords, { icon: makeIcon("#6d28d9", "A") }).addTo(map);
      if (toCoords) toMarkerRef.current = L.marker(toCoords, { icon: makeIcon("#059669", "B") }).addTo(map);

      if (fromCoords && toCoords) {
        map.fitBounds(L.latLngBounds([fromCoords, toCoords]), { padding: [30, 30], animate: true });
        routeLayerRef.current = L.polyline([fromCoords, toCoords], { color: "#6d28d9", weight: 4, opacity: 0.6, dashArray: "8,6" }).addTo(map);

        const routeCoords = await getRoute(fromCoords[0], fromCoords[1], toCoords[0], toCoords[1]);
        if (cancelled) return;
        if (routeCoords) {
          routeLayerRef.current?.remove();
          routeLayerRef.current = L.polyline(routeCoords, { color: "#6d28d9", weight: 5, opacity: 0.85 }).addTo(map);
          map.fitBounds(L.latLngBounds(routeCoords), { padding: [30, 30], animate: true });
        }
      } else if (fromCoords) {
        map.setView(fromCoords, 15, { animate: true });
      } else if (toCoords) {
        map.setView(toCoords, 15, { animate: true });
      }
    })();

    return () => { cancelled = true; };
  }, [fromAddress, toAddress, city, toCity]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    driverMarkerRef.current?.remove(); driverMarkerRef.current = null;
    if (driverCoords) {
      driverMarkerRef.current = L.marker(driverCoords, { icon: makeCarIcon(), zIndexOffset: 1000 }).addTo(map);
      const { from, to } = routePtsRef.current;
      const pts = [from, to, driverCoords].filter(Boolean) as [number, number][];
      if (pts.length > 1) map.fitBounds(L.latLngBounds(pts), { padding: [30, 30], animate: true });
      else map.setView(driverCoords, 15, { animate: true });
    }
  }, [driverCoords]);

  return (
    <div className={`relative rounded-2xl overflow-hidden ${className ?? ""}`} style={{ height }}>
      <div ref={mapRef} className="w-full h-full" />
      {!fromAddress && !toAddress && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-2 bg-white/80 backdrop-blur-sm rounded-2xl px-5 py-3 shadow-sm">
            <MapPin className="w-5 h-5 text-violet-500" />
            <span className="text-xs text-slate-500 font-medium">Введите адреса для маршрута</span>
          </div>
        </div>
      )}
      {loading && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none">
          <div className="bg-white/90 backdrop-blur-sm rounded-xl px-3 py-1.5 flex items-center gap-2 shadow-md">
            <Loader2 className="w-3 h-3 text-violet-600 animate-spin" />
            <span className="text-xs text-slate-600 font-medium">Строим маршрут...</span>
          </div>
        </div>
      )}
    </div>
  );
}
