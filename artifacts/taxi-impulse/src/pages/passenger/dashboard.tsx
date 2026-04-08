import { useState, useEffect } from "react";
import { Link } from "wouter";

import { MainLayout } from "@/components/layout/main-layout";
import { useOrdersQuery, useCreateOrderMutation, useEstimatePriceMutation, useUpdateOrderMutation, useRateOrderMutation } from "@/hooks/use-orders";
import { useCitiesQuery, useTariffsQuery, useTariffOptionsQuery } from "@/hooks/use-admin";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { formatMoney } from "@/lib/utils";
import { OrderChat } from "@/components/chat/order-chat";
import { SupportChat } from "@/components/support/support-chat";
import { RatingModal } from "@/components/rating/rating-modal";
import { TwoGisMap } from "@/components/map/twogis-map";
import { MapPickerModal } from "@/components/map/map-picker-modal";
import {
  MapPin, Clock, Car, X, ChevronRight, Loader2,
  Navigation, Phone, MessageCircle, Star, ChevronDown,
  Headphones, UserPlus, ArrowLeftRight, SlidersHorizontal, Check,
  Package, MessageSquare, UserCircle
} from "lucide-react";
import { PassengerProfileModal } from "@/components/passenger/profile-modal";
import { cn } from "@/lib/utils";

const CITY_KEY = "taxi_passenger_city";

function safeLocalStorage(key: string, fallback: string): string {
  try { return localStorage?.getItem(key) || fallback; } catch { return fallback; }
}
function safeSetLocalStorage(key: string, value: string) {
  try { localStorage?.setItem(key, value); } catch {}
}

export default function PassengerDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: cities } = useCitiesQuery();
  const { data: tariffs } = useTariffsQuery();
  const { data: orders, isLoading: ordersLoading } = useOrdersQuery({ passengerId: user?.id }, 10000);

  const createOrder = useCreateOrderMutation();
  const estimatePrice = useEstimatePriceMutation();
  const updateOrder = useUpdateOrderMutation();
  const rateOrder = useRateOrderMutation();

  const savedCity = safeLocalStorage(CITY_KEY, "Красноярск");
  const [city, setCity] = useState(savedCity);

  const { data: allOptions } = useTariffOptionsQuery(city);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [tariffId, setTariffId] = useState<number | null>(null);
  const [estimate, setEstimate] = useState<{ price: number; distance: number; duration: number } | null>(null);
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [showChat, setShowChat] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [ratingOrderId, setRatingOrderId] = useState<number | null>(null);
  const [ratingDriverName, setRatingDriverName] = useState("");

  const [orderMode, setOrderMode] = useState<'taxi' | 'delivery'>('taxi');
  const [comment, setComment] = useState("");
  const [packageDescription, setPackageDescription] = useState("");
  const [isIntercity, setIsIntercity] = useState(false);
  const [toCity, setToCity] = useState<string>("");
  const [showToCityPicker, setShowToCityPicker] = useState(false);
  const [selectedOptionIds, setSelectedOptionIds] = useState<number[]>([]);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [mapPicker, setMapPicker] = useState<'from' | 'to' | null>(null);
  const [showProfile, setShowProfile] = useState(false);

  usePushNotifications(user?.id, 'passenger', city);

  useEffect(() => { safeSetLocalStorage(CITY_KEY, city); }, [city]);

  const dismissedKey = `dismissed_ratings_${user?.id}`;
  const getDismissed = (): Set<number> => {
    try { return new Set(JSON.parse(safeLocalStorage(dismissedKey, "[]"))); }
    catch { return new Set(); }
  };
  const markDismissed = (id: number) => {
    const s = getDismissed(); s.add(id);
    safeSetLocalStorage(dismissedKey, JSON.stringify([...s]));
  };

  useEffect(() => {
    if (!Array.isArray(orders) || ratingOrderId) return;
    const dismissed = getDismissed();
    const unrated = orders.find(o => o.status === 'completed' && !o.rating && !dismissed.has(o.id));
    if (unrated) {
      setRatingOrderId(unrated.id);
      setRatingDriverName((unrated as any).driverName || 'водителя');
    }
  }, [orders]);

  const handleRate = async (rating: number) => {
    if (!ratingOrderId) return;
    try {
      await rateOrder.mutateAsync({ id: ratingOrderId, data: { rating } });
      markDismissed(ratingOrderId);
      toast({ title: "Спасибо за оценку!" });
    } catch {
      toast({ title: "Не удалось отправить оценку", variant: "destructive" });
    } finally {
      setRatingOrderId(null);
    }
  };

  const activeOrder = Array.isArray(orders) ? orders.find(o => ['pending', 'accepted', 'in_progress'].includes(o.status)) : undefined;
  const recentOrders = Array.isArray(orders) ? orders.filter(o => ['completed', 'cancelled'].includes(o.status)).slice(0, 5) : [];

  const driverCoords: [number, number] | null =
    activeOrder && activeOrder.driverLat && activeOrder.driverLon
      ? [activeOrder.driverLat, activeOrder.driverLon]
      : null;

  const resetForm = () => { setEstimate(null); setStep("form"); };

  useEffect(() => {
    if (!from.trim() || !to.trim() || !tariffId) return;
    if (isIntercity && !toCity) return;
    const timer = setTimeout(async () => {
      try {
        const res = await estimatePrice.mutateAsync({
          data: {
            city,
            fromAddress: from,
            toAddress: to,
            tariffId,
            ...(isIntercity && toCity ? { toCity } : {}),
          } as any,
        });
        const extraPrice = Array.isArray(allOptions)
          ? allOptions.filter((o: any) => o.isActive && selectedOptionIds.includes(o.id)).reduce((s: number, o: any) => s + (o.price || 0), 0)
          : 0;
        setEstimate({ price: res.estimatedPrice + extraPrice, distance: res.estimatedDistance, duration: res.estimatedDuration });
        setStep("confirm");
      } catch { /* тихо: покажем кнопку для ручного расчёта */ }
    }, 800);
    return () => clearTimeout(timer);
  }, [from, to, tariffId, city, toCity, isIntercity, selectedOptionIds]);

  const activeTariffs = (Array.isArray(tariffs) ? tariffs : [])
    .filter((t: any) => t.isActive)
    .sort((a: any, b: any) => {
      const order = (t: any) => t.name.includes('Эконом') ? 0 : t.name.includes('Комфорт') ? 1 : t.name.includes('Бизнес') ? 2 : 3;
      return order(a) - order(b);
    });

  const activeOptions = Array.isArray(allOptions) ? allOptions.filter((o: any) => o.isActive) : [];
  const optionsExtraPrice = activeOptions
    .filter((o: any) => selectedOptionIds.includes(o.id))
    .reduce((sum: number, o: any) => sum + (o.price || 0), 0);
  const toggleOption = (id: number) => {
    setSelectedOptionIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    resetForm();
  };

  const handleEstimate = async () => {
    if (!from.trim() || !to.trim()) {
      toast({ title: "Укажите адреса", variant: "destructive" });
      return;
    }
    if (!tariffId) {
      toast({ title: "Выберите тариф", variant: "destructive" });
      return;
    }
    if (isIntercity && !toCity) {
      toast({ title: "Выберите город назначения", variant: "destructive" });
      return;
    }
    try {
      const res = await estimatePrice.mutateAsync({
        data: {
          city,
          fromAddress: from,
          toAddress: to,
          tariffId,
          ...(isIntercity && toCity ? { toCity } : {}),
        } as any,
      });
      setEstimate({ price: res.estimatedPrice + optionsExtraPrice, distance: res.estimatedDistance, duration: res.estimatedDuration });
      setStep("confirm");
    } catch {
      toast({ title: "Ошибка расчёта", variant: "destructive" });
    }
  };

  const handleOrder = async () => {
    try {
      await createOrder.mutateAsync({
        data: {
          passengerId: user!.id,
          city,
          fromAddress: from,
          toAddress: to,
          tariffId: tariffId!,
          orderType: orderMode,
          ...(comment.trim() ? { comment: comment.trim() } : {}),
          ...(orderMode === 'delivery' && packageDescription.trim() ? { packageDescription: packageDescription.trim() } : {}),
          ...(isIntercity && toCity ? { toCity } : {}),
          ...(selectedOptionIds.length > 0 ? { optionIds: JSON.stringify(selectedOptionIds) } : {}),
        } as any
      });
      toast({ title: orderMode === 'delivery' ? "Доставка создана!" : "Заказ создан!", description: "Ищем водителя..." });
      setStep("form"); setEstimate(null); setFrom(""); setTo(""); setComment(""); setPackageDescription("");
    } catch {
      toast({ title: "Ошибка создания заказа", variant: "destructive" });
    }
  };

  const handleCancel = async (orderId: number) => {
    if (!confirm("Отменить заказ?")) return;
    try {
      await updateOrder.mutateAsync({ id: orderId, data: { status: 'cancelled' } });
      toast({ title: "Заказ отменён" });
    } catch {
      toast({ title: "Ошибка", variant: "destructive" });
    }
  };

  const statusInfo: Record<string, { label: string; color: string; bg: string }> = {
    pending: { label: "Ищем водителя...", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
    accepted: { label: "Водитель едет к вам", color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20" },
    in_progress: { label: "Вы в поездке", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  };

  const otherCities = Array.isArray(cities) ? cities.filter(c => c.name !== city) : [];

  return (
    <MainLayout allowedRoles={['passenger']}>
      <div className="max-w-lg mx-auto pb-6 space-y-0">

        {activeOrder ? (
          <div className="relative rounded-3xl overflow-hidden mb-4" style={{ minHeight: 260 }}>
            <div className="absolute inset-0">
              <TwoGisMap
                city={activeOrder.city}
                toCity={(activeOrder as any).toCity || undefined}
                fromAddress={activeOrder.fromAddress}
                toAddress={activeOrder.toAddress}
                driverCoords={driverCoords}
                className="w-full h-full rounded-none"
                height={260}
              />
            </div>

            <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
              <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium", statusInfo[activeOrder.status]?.bg, statusInfo[activeOrder.status]?.color)}>
                {activeOrder.status === 'pending' && <Navigation className="w-3 h-3 animate-pulse" />}
                {activeOrder.status === 'accepted' && <Car className="w-3 h-3" />}
                {activeOrder.status === 'in_progress' && <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />}
                {statusInfo[activeOrder.status]?.label}
              </div>
              <div className="text-lg font-bold text-white bg-black/40 backdrop-blur-sm px-3 py-1 rounded-full">
                {formatMoney(activeOrder.price || 0)}
              </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 px-4 py-4 bg-gradient-to-t from-[#0d0d1f] to-transparent">
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center gap-1 pt-0.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-violet-500 border-2 border-[#0d0d1f]" />
                  <div className="w-0.5 h-5 bg-white/10" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#0d0d1f]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white/70 truncate">{activeOrder.fromAddress}</div>
                  <div className="text-sm text-white/50 mt-1.5 truncate">
                    {(activeOrder as any).toCity ? `${(activeOrder as any).toCity} — ` : ''}{activeOrder.toAddress}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative rounded-3xl overflow-hidden mb-4 px-5 py-6" style={{ background: 'linear-gradient(135deg, #13132b 0%, #1a0d2e 100%)' }}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-violet-600/10 rounded-full -translate-y-8 translate-x-8" />
            <div className="relative z-10">
              <p className="text-white/50 text-sm">Добро пожаловать,</p>
              <h2 className="text-2xl font-bold text-white mt-0.5">{user?.name?.split(' ')[0]} 👋</h2>
              <p className="text-white/40 text-sm mt-2">Куда едем сегодня?</p>
            </div>
          </div>
        )}

        {activeOrder?.driverName && (
          <div className="bg-[#0d0d1f] border border-white/[0.08] rounded-2xl p-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-violet-600/20 flex items-center justify-center flex-shrink-0 text-violet-300 font-bold text-lg">
                {activeOrder.driverName.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-white font-semibold">{activeOrder.driverName}</span>
                  <div className="flex items-center gap-0.5 text-amber-400">
                    <Star className="w-3 h-3 fill-current" />
                    <span className="text-xs">4.9</span>
                  </div>
                </div>
                <div className="text-sm text-white/50 mt-0.5">
                  {activeOrder.driverCar} · <span className="text-white/70 font-medium">{activeOrder.driverCarNumber}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowChat(true)} className="w-10 h-10 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 flex items-center justify-center transition-colors">
                  <MessageCircle className="w-4 h-4 text-violet-400" />
                </button>
                <a href={`tel:${activeOrder.driverPhone}`} className="w-10 h-10 rounded-xl bg-white/[0.06] hover:bg-white/10 flex items-center justify-center transition-colors">
                  <Phone className="w-4 h-4 text-white/60" />
                </a>
              </div>
            </div>
          </div>
        )}

        {activeOrder?.status === 'pending' && !activeOrder.driverName && (
          <div className="bg-[#0d0d1f] border border-amber-500/20 rounded-2xl p-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
              </div>
              <div>
                <div className="text-sm font-medium text-white">Ищем ближайшего водителя</div>
                <div className="text-xs text-white/40 mt-0.5">Обычно это занимает 1–3 минуты</div>
              </div>
            </div>
          </div>
        )}

        {activeOrder?.status === 'pending' && (
          <button
            onClick={() => handleCancel(activeOrder.id)}
            className="w-full mb-4 py-3 rounded-2xl bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 text-red-400 text-sm font-medium transition-all flex items-center justify-center gap-2"
          >
            <X className="w-4 h-4" /> Отменить заказ
          </button>
        )}

        {!activeOrder && (
          <div className="bg-[#0d0d1f] border border-white/[0.08] rounded-3xl overflow-hidden mb-4">
            <div className="flex items-center gap-1 p-3 border-b border-white/[0.06] bg-white/[0.02]">
              <button
                onClick={() => { setOrderMode('taxi'); setTariffId(null); resetForm(); }}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all",
                  orderMode === 'taxi'
                    ? "bg-violet-600 text-white shadow-lg shadow-violet-600/25"
                    : "text-white/40 hover:text-white/60"
                )}
              >
                <Car className="w-4 h-4" /> Такси
              </button>
              <button
                onClick={() => { setOrderMode('delivery'); setTariffId(null); setIsIntercity(false); resetForm(); }}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all",
                  orderMode === 'delivery'
                    ? "bg-violet-600 text-white shadow-lg shadow-violet-600/25"
                    : "text-white/40 hover:text-white/60"
                )}
              >
                <Package className="w-4 h-4" /> Доставка
              </button>
            </div>

            <button
              onClick={() => setShowCityPicker(!showCityPicker)}
              className="w-full flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06] hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-violet-600/20 flex items-center justify-center">
                  <MapPin className="w-3.5 h-3.5 text-violet-400" />
                </div>
                <span className="text-sm font-medium text-white">{city}</span>
              </div>
              <div className="flex items-center gap-2">
                {orderMode === 'taxi' && (
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      setIsIntercity(!isIntercity);
                      if (!isIntercity) setShowToCityPicker(true);
                      resetForm();
                    }}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all",
                      isIntercity ? "bg-violet-600/25 text-violet-300 border border-violet-600/30" : "bg-white/[0.05] text-white/40 border border-white/[0.06] hover:border-white/15"
                    )}
                  >
                    <ArrowLeftRight className="w-3 h-3" />
                    Межгород
                  </button>
                )}
                <ChevronDown className={cn("w-4 h-4 text-white/30 transition-transform", showCityPicker && "rotate-180")} />
              </div>
            </button>

            {showCityPicker && (
              <div className="grid grid-cols-2 gap-1.5 p-3 border-b border-white/[0.06]">
                {Array.isArray(cities) && cities.map(c => (
                  <button
                    key={c.id}
                    onClick={() => { setCity(c.name); setShowCityPicker(false); resetForm(); }}
                    className={cn(
                      "px-3 py-2 rounded-xl text-sm text-left transition-all",
                      city === c.name
                        ? "bg-violet-600/20 border border-violet-600/30 text-violet-300"
                        : "bg-white/[0.04] hover:bg-white/[0.08] text-white/60"
                    )}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}

            {isIntercity && (
              <div className="border-b border-white/[0.06]">
                <button
                  onClick={() => setShowToCityPicker(!showToCityPicker)}
                  className="w-full flex items-center justify-between px-5 py-3 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <ArrowLeftRight className="w-4 h-4 text-violet-400" />
                    <span className="text-sm text-white/60">Город назначения:</span>
                    <span className={cn("text-sm font-medium", toCity ? "text-violet-300" : "text-white/30")}>
                      {toCity || "Выбрать..."}
                    </span>
                  </div>
                  <ChevronDown className={cn("w-3.5 h-3.5 text-white/30 transition-transform", showToCityPicker && "rotate-180")} />
                </button>
                {showToCityPicker && (
                  <div className="grid grid-cols-2 gap-1.5 px-3 pb-3">
                    {otherCities.map(c => (
                      <button
                        key={c.id}
                        onClick={() => { setToCity(c.name); setShowToCityPicker(false); resetForm(); }}
                        className={cn(
                          "px-3 py-2 rounded-xl text-sm text-left transition-all",
                          toCity === c.name
                            ? "bg-violet-600/20 border border-violet-600/30 text-violet-300"
                            : "bg-white/[0.04] hover:bg-white/[0.08] text-white/60"
                        )}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="px-5 py-4">
              {isIntercity && toCity && (
                <div className="flex items-center gap-2 mb-3 text-xs text-violet-400/80 bg-violet-600/5 border border-violet-600/15 rounded-xl px-3 py-2">
                  <ArrowLeftRight className="w-3 h-3 flex-shrink-0" />
                  Межгород: <span className="font-medium text-violet-300">{city}</span> → <span className="font-medium text-violet-300">{toCity}</span>
                </div>
              )}
              <div className="flex items-stretch gap-3">
                <div className="flex flex-col items-center py-1 gap-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-violet-500" />
                  <div className="flex-1 w-0.5 bg-white/[0.08] min-h-[24px]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2">
                    <input
                      value={from}
                      onChange={e => { setFrom(e.target.value); resetForm(); }}
                      placeholder={orderMode === 'delivery' ? "Откуда забрать посылку?" : "Откуда забрать?"}
                      maxLength={300}
                      className="flex-1 bg-white/[0.05] hover:bg-white/[0.07] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500/40 transition-all text-sm"
                    />
                    <button
                      onClick={() => setMapPicker('from')}
                      title="Указать на карте"
                      className="w-11 h-11 flex items-center justify-center rounded-xl bg-violet-600/10 hover:bg-violet-600/20 border border-violet-600/20 hover:border-violet-600/40 text-violet-400 transition-all shrink-0"
                    >
                      <MapPin className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={to}
                      onChange={e => { setTo(e.target.value); resetForm(); }}
                      placeholder={orderMode === 'delivery' ? "Куда доставить?" : (isIntercity && toCity ? `Адрес в ${toCity}` : "Куда едем?")}
                      maxLength={300}
                      className="flex-1 bg-white/[0.05] hover:bg-white/[0.07] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500/40 transition-all text-sm"
                    />
                    <button
                      onClick={() => setMapPicker('to')}
                      title="Указать на карте"
                      className="w-11 h-11 flex items-center justify-center rounded-xl bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-600/20 hover:border-emerald-600/40 text-emerald-400 transition-all shrink-0"
                    >
                      <MapPin className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {orderMode === 'delivery' && (
                <div className="mt-3 flex items-start gap-3">
                  <div className="w-2.5 mt-3.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Package className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-xs text-white/50">Описание посылки</span>
                    </div>
                    <textarea
                      value={packageDescription}
                      onChange={e => setPackageDescription(e.target.value)}
                      placeholder="Что нужно доставить? Например: документы, небольшая коробка..."
                      maxLength={500}
                      rows={2}
                      className="w-full bg-white/[0.05] hover:bg-white/[0.07] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all text-sm resize-none"
                    />
                  </div>
                </div>
              )}

              <div className="mt-3 flex items-start gap-3">
                <div className="w-2.5 mt-3.5 flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-white/30" />
                    <span className="text-xs text-white/30">Комментарий</span>
                    <span className="text-xs text-white/20">(необязательно)</span>
                  </div>
                  <input
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    placeholder={orderMode === 'delivery' ? "Позвоните за 10 мин, код домофона..." : "Подъезжайте к 5-му подъезду..."}
                    maxLength={500}
                    className="w-full bg-white/[0.05] hover:bg-white/[0.07] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500/40 transition-all text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="px-5 pb-4">
              <div className="text-xs text-white/30 uppercase tracking-wider mb-3">
                {orderMode === 'delivery' ? 'Тариф доставки' : 'Класс автомобиля'}
              </div>
              {activeTariffs.length === 0 ? (
                <div className="text-center text-white/30 text-sm py-4">
                  {orderMode === 'delivery' ? 'Тарифы доставки не настроены' : 'Тарифы такси не настроены'}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {activeTariffs.map((tariff: any) => (
                    <button
                      key={tariff.id}
                      onClick={() => { setTariffId(tariff.id); resetForm(); }}
                      className={cn(
                        "p-3.5 rounded-2xl border text-left transition-all",
                        tariffId === tariff.id
                          ? "bg-violet-600/20 border-violet-600/40 shadow-lg shadow-violet-600/10"
                          : "bg-white/[0.03] border-white/[0.06] hover:border-white/15"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center text-sm",
                          tariffId === tariff.id ? "bg-violet-600/30" : "bg-white/5"
                        )}>
                          {orderMode === 'delivery'
                            ? (tariff.name.includes('Лёгк') || tariff.name.includes('Мал') ? '📦' : tariff.name.includes('Груз') ? '🚚' : '📫')
                            : (tariff.name.includes('Эконом') ? '🚗' : tariff.name.includes('Комфорт') ? '🚙' : tariff.name.includes('Бизнес') ? '🚘' : '🚖')}
                        </div>
                        <span className="text-xs text-violet-400 font-medium">от {formatMoney(tariff.minPrice)}</span>
                      </div>
                      <div className="text-sm font-semibold text-white">{tariff.name}</div>
                      <div className="text-xs text-white/40 mt-0.5">{tariff.pricePerKm} ₽/км</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {activeOptions.length > 0 && (
              <div className="px-5 pb-4">
                <button
                  onClick={() => setShowOptionsModal(true)}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-3 rounded-2xl border transition-all",
                    selectedOptionIds.length > 0
                      ? "bg-violet-600/15 border-violet-600/30 text-violet-300"
                      : "bg-white/[0.03] border-white/[0.06] text-white/50 hover:border-white/15"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <SlidersHorizontal className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      {selectedOptionIds.length > 0
                        ? `Опции · ${selectedOptionIds.length} выбрано`
                        : "Дополнительные опции"}
                    </span>
                  </div>
                  {selectedOptionIds.length > 0 && optionsExtraPrice > 0 && (
                    <span className="text-xs font-semibold text-violet-400">+{formatMoney(optionsExtraPrice)}</span>
                  )}
                </button>
              </div>
            )}

            <div className="px-5 pb-5">
              {step === "confirm" && estimate ? (
                <div className="space-y-3">
                  <div className="bg-violet-600/10 border border-violet-600/20 rounded-2xl p-4 flex items-center justify-between">
                    <div>
                      <div className="text-xs text-white/40 mb-0.5">Стоимость поездки</div>
                      <div className="text-2xl font-bold text-white">{formatMoney(estimate.price)}</div>
                      {isIntercity && toCity && (
                        <div className="text-xs text-violet-400/70 mt-0.5">{city} → {toCity}</div>
                      )}
                      {optionsExtraPrice > 0 && (
                        <div className="text-xs text-violet-400/60 mt-0.5">вкл. опции +{formatMoney(optionsExtraPrice)}</div>
                      )}
                    </div>
                    <div className="text-right space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-white/40 justify-end">
                        <Clock className="w-3 h-3" /> ~{estimate.duration} мин
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-white/40 justify-end">
                        <MapPin className="w-3 h-3" /> {estimate.distance.toFixed(1)} км
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setStep("form"); setEstimate(null); }}
                      className="px-4 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white/60 text-sm transition-all"
                    >
                      Изменить
                    </button>
                    <button
                      onClick={handleOrder}
                      disabled={createOrder.isPending}
                      className="flex-1 py-3 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-violet-600/25"
                    >
                      {createOrder.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Заказать <ChevronRight className="w-4 h-4" /></>}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleEstimate}
                  disabled={estimatePrice.isPending}
                  className="w-full py-3.5 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-violet-600/25 text-sm"
                >
                  {estimatePrice.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Рассчитать стоимость"}
                </button>
              )}
            </div>
          </div>
        )}

        {!activeOrder && (
          <div className="mb-4">
            <TwoGisMap
              city={city}
              toCity={isIntercity && toCity ? toCity : undefined}
              fromAddress={from.trim() || undefined}
              toAddress={to.trim() || undefined}
            />
          </div>
        )}

        <button
          onClick={() => setShowProfile(true)}
          className="w-full flex items-center gap-3 px-4 py-3.5 bg-[#0d0d1f] border border-white/[0.08] rounded-2xl hover:border-violet-500/20 transition-all mb-3"
        >
          <div className="w-9 h-9 rounded-xl bg-violet-600/10 flex items-center justify-center">
            <UserCircle className="w-4 h-4 text-violet-300" />
          </div>
          <div className="text-left">
            <div className="text-sm font-medium text-white">Мой профиль</div>
            <div className="text-xs text-white/40">{user?.name} · {user?.phone}</div>
          </div>
          <ChevronRight className="w-4 h-4 text-white/20 ml-auto" />
        </button>

        <button
          onClick={() => setShowSupport(true)}
          className="w-full flex items-center gap-3 px-4 py-3.5 bg-[#0d0d1f] border border-white/[0.08] rounded-2xl hover:border-violet-500/20 transition-all mb-3"
        >
          <div className="w-9 h-9 rounded-xl bg-violet-600/20 flex items-center justify-center">
            <Headphones className="w-4 h-4 text-violet-400" />
          </div>
          <div className="text-left">
            <div className="text-sm font-medium text-white">Техподдержка</div>
            <div className="text-xs text-white/40">Онлайн · Ответим быстро</div>
          </div>
          <ChevronRight className="w-4 h-4 text-white/20 ml-auto" />
        </button>

        <Link href="/register-driver">
          <div className="w-full flex items-center gap-3 px-4 py-3.5 bg-[#0d0d1f] border border-white/[0.08] rounded-2xl hover:border-violet-500/20 transition-all mb-4 cursor-pointer">
            <div className="w-9 h-9 rounded-xl bg-violet-600/10 flex items-center justify-center">
              <UserPlus className="w-4 h-4 text-violet-300" />
            </div>
            <div className="text-left">
              <div className="text-sm font-medium text-white">Стать водителем</div>
              <div className="text-xs text-white/40">Зарабатывайте с нами</div>
            </div>
            <ChevronRight className="w-4 h-4 text-white/20 ml-auto" />
          </div>
        </Link>

        {recentOrders && recentOrders.length > 0 && (
          <div>
            <div className="text-xs text-white/30 uppercase tracking-wider mb-3 px-1">История поездок</div>
            <div className="bg-[#0d0d1f] border border-white/[0.08] rounded-2xl overflow-hidden">
              {recentOrders.map((order, i) => (
                <div key={order.id} className={cn(
                  "flex items-center gap-3 px-4 py-3.5",
                  i < recentOrders.length - 1 && "border-b border-white/[0.04]"
                )}>
                  <div className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center text-xs flex-shrink-0",
                    order.status === 'completed' ? "bg-emerald-500/10" : "bg-red-500/10"
                  )}>
                    {order.status === 'completed' ? '✓' : '✕'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white/80 truncate">
                      {(order as any).toCity ? `${(order as any).toCity} — ` : ''}{order.toAddress}
                    </div>
                    <div className="text-xs text-white/30 mt-0.5">{order.city}</div>
                  </div>
                  <div className={cn("text-sm font-semibold flex-shrink-0",
                    order.status === 'completed' ? "text-white" : "text-red-400"
                  )}>
                    {order.status === 'completed' ? formatMoney(order.price || 0) : "Отменён"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showChat && activeOrder && (
        <OrderChat orderId={activeOrder.id} onClose={() => setShowChat(false)} />
      )}

      {showSupport && (
        <SupportChat onClose={() => setShowSupport(false)} />
      )}

      {ratingOrderId && (
        <RatingModal
          driverName={ratingDriverName}
          onRate={handleRate}
          onSkip={() => { markDismissed(ratingOrderId); setRatingOrderId(null); }}
          isPending={rateOrder.isPending}
        />
      )}

      {mapPicker && (
        <MapPickerModal
          city={mapPicker === 'to' && isIntercity && toCity ? toCity : city}
          title={mapPicker === 'from' ? 'Откуда забрать?' : (isIntercity && toCity ? `Куда в ${toCity}?` : 'Куда едем?')}
          onSelect={(address) => {
            if (mapPicker === 'from') { setFrom(address); } else { setTo(address); }
            resetForm();
            setMapPicker(null);
          }}
          onClose={() => setMapPicker(null)}
        />
      )}

      {showOptionsModal && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowOptionsModal(false)} />
          <div className="relative w-full max-w-md mx-auto bg-[#0d0d1f] border border-white/[0.08] rounded-t-3xl p-5 z-10">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-white">Дополнительные опции</h2>
              <button onClick={() => setShowOptionsModal(false)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/[0.06] hover:bg-white/10 transition-colors">
                <X className="w-4 h-4 text-white/60" />
              </button>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {activeOptions.map((opt: any) => (
                <button
                  key={opt.id}
                  onClick={() => toggleOption(opt.id)}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border transition-all",
                    selectedOptionIds.includes(opt.id)
                      ? "bg-violet-600/15 border-violet-600/30"
                      : "bg-white/[0.03] border-white/[0.06] hover:border-white/15"
                  )}
                >
                  <div className="text-left">
                    <div className={cn("text-sm font-medium", selectedOptionIds.includes(opt.id) ? "text-violet-300" : "text-white/80")}>{opt.name}</div>
                    {opt.description && <div className="text-xs text-white/30 mt-0.5">{opt.description}</div>}
                  </div>
                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    <span className="text-sm font-semibold text-violet-400">+{formatMoney(opt.price)}</span>
                    {selectedOptionIds.includes(opt.id) && <Check className="w-4 h-4 text-violet-400" />}
                  </div>
                </button>
              ))}
            </div>
            {selectedOptionIds.length > 0 && (
              <div className="mt-4 pt-4 border-t border-white/[0.08] flex items-center justify-between">
                <span className="text-sm text-white/50">Итого опции</span>
                <span className="text-sm font-bold text-violet-400">+{formatMoney(optionsExtraPrice)}</span>
              </div>
            )}
            <button
              onClick={() => setShowOptionsModal(false)}
              className="mt-4 w-full py-3 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-all"
            >
              Применить
            </button>
          </div>
        </div>
      )}

      <PassengerProfileModal open={showProfile} onClose={() => setShowProfile(false)} />
    </MainLayout>
  );
}
