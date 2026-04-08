import { useEffect, useRef, useState, useCallback } from "react";
import { X, MapPin, Loader2, Check, Navigation } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const CITY_CENTERS: Record<string, [number, number]> = {
  "Красноярск":    [56.010563, 92.852572], "Ачинск":        [56.267400, 90.500800],
  "Канск":         [56.203000, 95.717000], "Минусинск":     [53.705000, 91.689000],
  "Норильск":      [69.348000, 88.189000], "Лесосибирск":   [58.235000, 92.480000],
  "Шарыпово":      [55.533000, 89.172000], "Зеленогорск":   [56.115000, 93.533000],
  "Железногорск":  [56.251000, 93.532000], "Сосновоборск":  [56.116000, 93.338000],
  "Назарово":      [56.009000, 90.399000], "Дивногорск":    [55.961000, 91.374000],
  "Енисейск":      [58.454000, 92.164000], "Бородино":      [55.905000, 96.064000],
  "Игарка":        [67.473000, 86.573000], "Заозёрный":     [55.959000, 94.707000],
  "Кодинск":       [58.603000, 99.219000], "Уяр":           [55.814000, 96.051000],
  "Иланский":      [56.236000, 96.072000], "Козулька":      [56.011000, 89.881000],
  "Ужур":          [55.311900, 89.825600], "Абакан":        [53.721100, 91.442600],
  "Боготол":       [56.201000, 89.531000], "Балахта":       [55.374500, 91.622100],
  "Березовка":     [56.142000, 92.907000], "Большая Мурта": [56.760000, 93.226000],
  "Большой Улуй":  [56.940000, 90.830000], "Дудинка":       [69.397000, 86.179000],
  "Емельяново":    [56.177000, 92.614000], "Партизанское":  [54.800000, 90.434000],
  "Сухобузимо":    [57.000000, 93.100000], "Тюхтет":        [56.528000, 89.352000],
  "Усть-Абакан":   [53.749000, 91.431000],
};

const fwdCache = new Map<string, [number, number] | null>();
async function geocodeCity(cityName: string): Promise<[number, number] | null> {
  if (fwdCache.has(cityName)) return fwdCache.get(cityName)!;
  try {
    const url = `${BASE}/api/geocode?q=${encodeURIComponent(cityName + ", Красноярский край")}&city=`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) { fwdCache.set(cityName, null); return null; }
    const data = await res.json() as { lat: number; lon: number };
    if (typeof data.lat !== "number") { fwdCache.set(cityName, null); return null; }
    const coords: [number, number] = [data.lat, data.lon];
    fwdCache.set(cityName, coords);
    return coords;
  } catch { return null; }
}

const revCache = new Map<string, string>();
async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  if (revCache.has(key)) return revCache.get(key)!;
  try {
    const res = await fetch(`${BASE}/api/reverse-geocode?lat=${lat}&lon=${lon}`, {
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { address?: string };
    if (data?.address) { revCache.set(key, data.address); return data.address; }
    return null;
  } catch {
    return null;
  }
}

interface Props {
  city: string;
  title: string;
  onSelect: (address: string) => void;
  onClose: () => void;
}

export function MapPickerModal({ city, title, onSelect, onClose }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const mountedRef = useRef(true);
  const centerRef = useRef<[number, number]>(CITY_CENTERS[city] ?? [56.010563, 92.852572]);
  const geocodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [address, setAddress] = useState("");
  const [geocoding, setGeocoding] = useState(false);

  const triggerReverseGeocode = useCallback((lat: number, lon: number) => {
    if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
    geocodeTimerRef.current = setTimeout(async () => {
      if (!mountedRef.current) return;
      setGeocoding(true);
      const addr = await reverseGeocode(lat, lon);
      if (!mountedRef.current) return;
      setGeocoding(false);
      setAddress(addr || `${lat.toFixed(5)}, ${lon.toFixed(5)}`);
    }, 400);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    if (!mapRef.current) return;

    const knownCenter = CITY_CENTERS[city];
    const initCenter: [number, number] = knownCenter ?? [56.010563, 92.852572];
    centerRef.current = initCenter;

    const map = L.map(mapRef.current, { zoomControl: true, attributionControl: false });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
    map.setView(initCenter, 15);

    if (!knownCenter) {
      geocodeCity(city).then(coords => {
        if (coords && mountedRef.current && mapInstanceRef.current === map) {
          centerRef.current = coords;
          map.setView(coords, 15);
          triggerReverseGeocode(coords[0], coords[1]);
        }
      });
    }

    map.on("moveend", () => {
      if (!mountedRef.current) return;
      const c = map.getCenter();
      centerRef.current = [c.lat, c.lng];
      triggerReverseGeocode(c.lat, c.lng);
    });

    mapInstanceRef.current = map;
    setMapReady(true);
    triggerReverseGeocode(initCenter[0], initCenter[1]);

    return () => {
      mountedRef.current = false;
      if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
      try { map.remove(); } catch {}
      mapInstanceRef.current = null;
    };
  }, [city, triggerReverseGeocode]);

  const handleConfirm = useCallback(() => {
    const val = address.trim();
    if (val) onSelect(val);
    else {
      const [lat, lon] = centerRef.current;
      onSelect(`${lat.toFixed(5)}, ${lon.toFixed(5)}`);
    }
    onClose();
  }, [address, onSelect, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-50">
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 shrink-0 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
            <MapPin className="w-4 h-4 text-violet-600" />
          </div>
          <span className="text-sm font-semibold text-slate-800">{title}</span>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors"
        >
          <X className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <div ref={mapRef} className="w-full h-full" />

        {!mapReady && (
          <div className="absolute inset-0 bg-slate-100 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 text-violet-600 animate-spin" />
            <span className="text-sm text-slate-500">Загрузка карты...</span>
          </div>
        )}

        {mapReady && (
          <>
            <div
              className="absolute pointer-events-none"
              style={{ left: "50%", top: "50%", transform: "translate(-50%, -100%)", zIndex: 1000 }}
            >
              <div className="relative flex flex-col items-center">
                <div
                  className="absolute rounded-full bg-violet-400/20 animate-ping"
                  style={{ width: 44, height: 44, top: "50%", left: "50%", transform: "translate(-50%, -50%)", animationDuration: "2s" }}
                />
                <svg xmlns="http://www.w3.org/2000/svg" width="44" height="58" viewBox="0 0 36 48"
                  style={{ filter: "drop-shadow(0 3px 8px rgba(109,40,217,0.45))" }}>
                  <path d="M18 1C8.611 1 1 8.611 1 18c0 5.188 2.188 9.852 5.688 13.145L18 47l11.312-15.855C32.812 27.852 35 23.188 35 18 35 8.611 27.389 1 18 1z" fill="#6d28d9"/>
                  <circle cx="18" cy="18" r="11" fill="rgba(255,255,255,0.2)"/>
                  <circle cx="18" cy="18" r="6" fill="white"/>
                  <circle cx="18" cy="18" r="3" fill="#6d28d9"/>
                </svg>
              </div>
            </div>

            <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm rounded-xl px-3 py-1.5 shadow-sm border border-slate-200/80 text-xs text-slate-500 font-medium pointer-events-none whitespace-nowrap" style={{ zIndex: 1000 }}>
              Перемещайте карту для выбора точки
            </div>
          </>
        )}
      </div>

      <div className="px-4 pt-3 pb-5 bg-white border-t border-slate-200 shrink-0 space-y-3 shadow-[0_-4px_20px_rgba(0,0,0,0.07)]">
        <div className="flex items-start gap-2.5 min-h-[48px] bg-slate-50 rounded-2xl px-4 py-3 border border-slate-100">
          <Navigation className="w-4 h-4 text-violet-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            {geocoding ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-violet-500 animate-spin shrink-0" />
                <span className="text-sm text-slate-400">Определяем адрес...</span>
              </div>
            ) : address ? (
              <p className="text-sm text-slate-700 leading-snug font-medium break-words">{address}</p>
            ) : (
              <span className="text-sm text-slate-400">Переместите карту...</span>
            )}
          </div>
        </div>

        <button
          onClick={handleConfirm}
          disabled={geocoding || !mapReady}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-violet-600 hover:bg-violet-700 active:scale-[0.98] disabled:opacity-50 text-white font-semibold text-sm transition-all shadow-lg shadow-violet-500/25"
        >
          <Check className="w-4 h-4" />
          Выбрать это место
        </button>
      </div>
    </div>
  );
}
