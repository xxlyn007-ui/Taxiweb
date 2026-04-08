import { useState, useEffect, useRef } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { useAuth } from "@/hooks/use-auth";
import { useDriversQuery, useUpdateDriverStatusMutation, useUpdateDriverMutation } from "@/hooks/use-drivers";
import { useOrdersQuery, useUpdateOrderMutation } from "@/hooks/use-orders";
import { useCitiesQuery, useTariffsQuery } from "@/hooks/use-admin";
import { useAuthHeaders } from "@/hooks/use-auth";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { useDriverSubscriptionQuery, useCreatePaymentMutation, useConfirmPaymentMutation } from "@/hooks/use-subscriptions";
import { formatMoney } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { OrderChat } from "@/components/chat/order-chat";
import { SupportChat } from "@/components/support/support-chat";
import {
  Power, Zap, Phone, MapPin, ChevronRight, Star, Wallet,
  Check, X, MessageCircle, Car, Headphones, ChevronDown, Navigation,
  CreditCard, Clock, AlertTriangle, CheckCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

export default function DriverDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const authHeaders = useAuthHeaders();
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [showTariffPicker, setShowTariffPicker] = useState(false);
  const [geoEnabled, setGeoEnabled] = useState(false);
  const locationIntervalRef = useRef<any>(null);

  const { data: drivers, isLoading } = useDriversQuery();
  const { data: cities } = useCitiesQuery();
  const { data: tariffs } = useTariffsQuery();
  const myProfile = drivers?.find(d => d.userId === user?.id);

  const updateStatus = useUpdateDriverStatusMutation();
  const updateDriver = useUpdateDriverMutation();
  const updateOrder = useUpdateOrderMutation();

  const isOnline = myProfile?.status === 'online' || myProfile?.status === 'busy';
  const workCity = myProfile?.workCity || myProfile?.city || 'Не указан';

  // Поллинг активного заказа когда водитель на линии (обновление статуса, отмена пассажиром и т.д.)
  const { data: orders } = useOrdersQuery(
    { driverId: myProfile?.id },
    isOnline ? 8000 : undefined,
  );
  const activeOrder = orders?.find(o => ['accepted', 'in_progress'].includes(o.status));

  usePushNotifications(user?.id, 'driver', workCity !== 'Не указан' ? workCity : undefined);

  const { data: subscription, refetch: refetchSub } = useDriverSubscriptionQuery(myProfile?.id);
  const createPayment = useCreatePaymentMutation();
  const confirmPayment = useConfirmPaymentMutation();

  useEffect(() => {
    if (!myProfile?.id) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("from_payment") === "1") {
      confirmPayment.mutateAsync(myProfile.id).then(r => {
        if (r?.activated) {
          toast({ title: "✅ Подписка активирована!", description: "Теперь вы можете принимать заказы" });
        }
        refetchSub();
        window.history.replaceState({}, "", window.location.pathname);
      }).catch(() => {});
    }
  }, [myProfile?.id]);

  const handlePay = async () => {
    if (!myProfile?.id) return;
    const returnUrl = window.location.href.split("?")[0] + "?from_payment=1";
    try {
      const result = await createPayment.mutateAsync({ driverId: myProfile.id, returnUrl });
      if (result.confirmationUrl) {
        window.location.href = result.confirmationUrl;
      } else if (!result.yookassaConfigured) {
        await confirmPayment.mutateAsync(myProfile.id);
        toast({ title: "✅ Подписка активирована! (тест)", description: "ЮKassa не настроена — активация в тестовом режиме" });
        refetchSub();
      }
    } catch {
      toast({ title: "Ошибка оплаты", description: "Не удалось создать платёж", variant: "destructive" });
    }
  };

  const subStatus = subscription?.effectiveStatus;
  const subDaysLeft = subscription?.daysLeft ?? 0;
  const subscriptionBlocked = subStatus === "expired" || subStatus === "pending";

  const approvedTariffIds: number[] = (myProfile as any)?.approvedTariffIds || [];
  const activeTariffIds: number[] = (myProfile as any)?.activeTariffIds || [];
  const approvedTariffs = Array.isArray(tariffs) ? tariffs.filter(t => approvedTariffIds.includes(t.id)) : [];

  const sendLocation = (lat: number, lon: number) => {
    if (!myProfile?.id) return;
    fetch(`${BASE}/api/drivers/${myProfile.id}/location`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders.headers },
      body: JSON.stringify({ lat, lon }),
    }).catch(() => {});
  };

  useEffect(() => {
    if (!isOnline || !myProfile?.id) {
      clearInterval(locationIntervalRef.current);
      setGeoEnabled(false);
      return;
    }
    if (!navigator.geolocation) return;

    const start = () => {
      navigator.geolocation.getCurrentPosition(
        pos => {
          setGeoEnabled(true);
          sendLocation(pos.coords.latitude, pos.coords.longitude);
        },
        () => setGeoEnabled(false),
        { enableHighAccuracy: true, timeout: 5000 },
      );
    };

    start();
    locationIntervalRef.current = setInterval(start, 10000);
    return () => clearInterval(locationIntervalRef.current);
  }, [isOnline, myProfile?.id]);

  const toggleOnline = async () => {
    if (!myProfile || activeOrder) return;
    const next = myProfile.status === 'online' ? 'offline' : 'online';
    try {
      await updateStatus.mutateAsync({ id: myProfile.id, data: { status: next } });
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
    } catch { toast({ title: "Ошибка", variant: "destructive" }); }
  };

  const toggleAutoAssign = async () => {
    if (!myProfile) return;
    try {
      await updateDriver.mutateAsync({ id: myProfile.id, data: { autoAssign: !myProfile.autoAssign } });
      toast({ title: myProfile.autoAssign ? "Авто-назначение выключено" : "Авто-назначение включено" });
    } catch { toast({ title: "Ошибка", variant: "destructive" }); }
  };

  const changeWorkCity = async (city: string) => {
    if (!myProfile) return;
    try {
      await updateDriver.mutateAsync({ id: myProfile.id, data: { workCity: city } });
      toast({ title: `Город изменён на ${city}` });
      setShowCityPicker(false);
    } catch { toast({ title: "Ошибка", variant: "destructive" }); }
  };

  const toggleActiveTariff = async (tariffId: number) => {
    if (!myProfile) return;
    const next = activeTariffIds.includes(tariffId)
      ? activeTariffIds.filter(id => id !== tariffId)
      : [...activeTariffIds, tariffId];
    try {
      await updateDriver.mutateAsync({ id: myProfile.id, data: { activeTariffIds: next } as any });
    } catch { toast({ title: "Ошибка", variant: "destructive" }); }
  };

  const startTrip = async () => {
    if (!activeOrder) return;
    try { await updateOrder.mutateAsync({ id: activeOrder.id, data: { status: 'in_progress' } }); }
    catch { toast({ title: "Ошибка", variant: "destructive" }); }
  };

  const completeTrip = async () => {
    if (!activeOrder) return;
    try {
      await updateOrder.mutateAsync({ id: activeOrder.id, data: { status: 'completed' } });
      toast({ title: "Поездка завершена! 🎉" });
    } catch { toast({ title: "Ошибка", variant: "destructive" }); }
  };

  const cancelOrder = async () => {
    if (!activeOrder) return;
    if (!confirm("Отменить текущий заказ?")) return;
    try {
      await updateOrder.mutateAsync({ id: activeOrder.id, data: { status: 'cancelled' } });
      toast({ title: "Заказ отменён" });
    } catch { toast({ title: "Ошибка", variant: "destructive" }); }
  };

  if (isLoading) return (
    <MainLayout allowedRoles={['driver']}>
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
      </div>
    </MainLayout>
  );

  return (
    <MainLayout allowedRoles={['driver']}>
      <div className="max-w-2xl mx-auto space-y-3 pb-8">

        {/* Subscription banner */}
        {subscription && subStatus === "expired" && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
              <div className="flex-1">
                <div className="text-sm font-semibold text-red-300">Подписка истекла</div>
                <div className="text-xs text-red-400/70 mt-0.5">Вы не можете принимать заказы. Оплатите подписку, чтобы продолжить работу.</div>
              </div>
            </div>
            <button
              onClick={handlePay}
              disabled={createPayment.isPending}
              className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500 hover:bg-red-400 text-white text-sm font-semibold transition-all"
            >
              <CreditCard className="w-4 h-4" />
              {createPayment.isPending ? "Создание платежа..." : `Оплатить подписку`}
            </button>
          </div>
        )}

        {subscription && subStatus === "pending" && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
              <div className="flex-1">
                <div className="text-sm font-semibold text-amber-300">Ожидает подтверждения оплаты</div>
                <div className="text-xs text-amber-400/70 mt-0.5">Платёж обрабатывается. Если уже оплатили — проверьте статус.</div>
              </div>
            </div>
          </div>
        )}

        {subscription && subStatus === "trial" && subDaysLeft <= 7 && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
              <div className="flex-1">
                <div className="text-sm font-semibold text-blue-300">Пробный период заканчивается</div>
                <div className="text-xs text-blue-400/70 mt-0.5">
                  Осталось {subDaysLeft} {subDaysLeft === 1 ? "день" : subDaysLeft < 5 ? "дня" : "дней"}. После окончания потребуется оплата подписки.
                </div>
              </div>
            </div>
            <button
              onClick={handlePay}
              disabled={createPayment.isPending}
              className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-400 text-white text-sm font-semibold transition-all"
            >
              <CreditCard className="w-4 h-4" />
              Оплатить заранее
            </button>
          </div>
        )}

        {subscription && subStatus === "active" && (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl px-4 py-3 flex items-center gap-3">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="flex-1 text-xs text-white/50">
              Подписка активна · до {new Date(subscription.endDate).toLocaleDateString("ru-RU")}
              {subDaysLeft <= 7 && <span className="text-amber-400 ml-1">· осталось {subDaysLeft} дн.</span>}
            </div>
            {subDaysLeft <= 7 && (
              <button onClick={handlePay} disabled={createPayment.isPending} className="text-xs text-violet-400 hover:text-violet-300 font-medium transition-colors">
                Продлить
              </button>
            )}
          </div>
        )}

        {/* Status card */}
        <div className="bg-[#0d0d1f] border border-white/[0.08] rounded-3xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <button
                onClick={toggleOnline}
                disabled={updateStatus.isPending || !!activeOrder}
                className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center transition-all font-bold shadow-lg",
                  isOnline ? "bg-emerald-500 shadow-emerald-500/25 hover:bg-emerald-400" : "bg-white/10 hover:bg-white/15",
                  activeOrder && "opacity-40 cursor-not-allowed"
                )}
              >
                <Power className={cn("w-6 h-6", isOnline ? "text-white" : "text-white/60")} />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <span className={cn("text-base font-bold", isOnline ? "text-white" : "text-white/50")}>
                    {myProfile?.status === 'busy' ? "В поездке" : isOnline ? "На линии" : "Оффлайн"}
                  </span>
                  {isOnline && <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />}
                  {geoEnabled && isOnline && (
                    <div className="flex items-center gap-1 text-xs text-emerald-400/70">
                      <Navigation className="w-3 h-3" /> GPS
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setShowCityPicker(!showCityPicker)}
                  className="flex items-center gap-1 text-sm text-white/40 hover:text-white/70 transition-colors mt-0.5"
                >
                  <MapPin className="w-3 h-3" />
                  {workCity}
                  <ChevronDown className={cn("w-3 h-3 ml-0.5 transition-transform", showCityPicker && "rotate-180")} />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-xs text-white/30 mb-0.5">Баланс</div>
                <div className="text-sm font-bold text-emerald-400">{formatMoney(myProfile?.balance || 0)}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-white/30 mb-0.5">Рейтинг</div>
                <div className="text-sm font-bold text-amber-400 flex items-center gap-0.5">
                  <Star className="w-3 h-3 fill-current" />{myProfile?.rating?.toFixed(1) || '5.0'}
                </div>
              </div>
            </div>
          </div>

          {showCityPicker && (
            <div className="border-t border-white/[0.06] pt-3 mt-1">
              <p className="text-xs text-white/30 uppercase tracking-wider mb-2">Выберите город работы</p>
              <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto">
                {cities?.map(c => (
                  <button
                    key={c.id}
                    onClick={() => changeWorkCity(c.name)}
                    className={cn(
                      "px-3 py-2 rounded-xl text-sm text-left transition-all flex items-center justify-between",
                      workCity === c.name ? "bg-violet-600/20 border border-violet-600/30 text-violet-300" : "bg-white/[0.04] hover:bg-white/[0.08] text-white/60"
                    )}
                  >
                    {c.name}
                    {workCity === c.name && <Check className="w-3 h-3" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-white/[0.06] pt-4 mt-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-violet-600/20 flex items-center justify-center">
                <Zap className="w-4 h-4 text-violet-400" />
              </div>
              <div>
                <div className="text-sm font-medium text-white">Авто-назначение</div>
                <div className="text-xs text-white/30">Приоритет в радиусе 2 км</div>
              </div>
            </div>
            <button
              onClick={toggleAutoAssign}
              disabled={updateDriver.isPending}
              className={cn("relative w-11 h-6 rounded-full transition-all", myProfile?.autoAssign ? "bg-violet-600" : "bg-white/10")}
            >
              <div className={cn("absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all", myProfile?.autoAssign ? "left-6" : "left-1")} />
            </button>
          </div>
        </div>

        {/* Tariff class selection */}
        {approvedTariffs.length > 0 && (
          <div className="bg-[#0d0d1f] border border-white/[0.08] rounded-3xl overflow-hidden">
            <button
              onClick={() => setShowTariffPicker(!showTariffPicker)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-violet-600/20 flex items-center justify-center">
                  <Car className="w-4 h-4 text-violet-400" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-medium text-white">Классы заказов</div>
                  <div className="text-xs text-white/40">
                    {activeTariffIds.length === 0
                      ? "Все доступные классы"
                      : `Выбрано: ${activeTariffIds.length} из ${approvedTariffs.length}`}
                  </div>
                </div>
              </div>
              <ChevronDown className={cn("w-4 h-4 text-white/30 transition-transform", showTariffPicker && "rotate-180")} />
            </button>
            {showTariffPicker && (
              <div className="border-t border-white/[0.06] px-5 pb-4 pt-3">
                <p className="text-xs text-white/30 mb-3">Выберите классы для получения заказов</p>
                <div className="grid grid-cols-1 gap-2">
                  {approvedTariffs.map(tariff => {
                    const isActive = activeTariffIds.length === 0 || activeTariffIds.includes(tariff.id);
                    return (
                      <button
                        key={tariff.id}
                        onClick={() => toggleActiveTariff(tariff.id)}
                        className={cn(
                          "flex items-center gap-3 px-4 py-3 rounded-2xl border text-left transition-all",
                          activeTariffIds.includes(tariff.id)
                            ? "bg-violet-600/15 border-violet-600/30"
                            : activeTariffIds.length === 0
                              ? "bg-emerald-500/5 border-emerald-500/20"
                              : "bg-white/[0.03] border-white/[0.06]"
                        )}
                      >
                        <div className={cn(
                          "w-5 h-5 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all",
                          activeTariffIds.includes(tariff.id)
                            ? "bg-violet-600 border-violet-600"
                            : activeTariffIds.length === 0
                              ? "bg-emerald-500/20 border-emerald-500/40"
                              : "border-white/20"
                        )}>
                          {(activeTariffIds.includes(tariff.id) || activeTariffIds.length === 0) &&
                            <Check className="w-3 h-3 text-white" />}
                        </div>
                        <div className="flex-1">
                          <div className={cn("text-sm font-semibold",
                            activeTariffIds.includes(tariff.id) ? "text-violet-300"
                              : activeTariffIds.length === 0 ? "text-white"
                                : "text-white/40"
                          )}>{tariff.name}</div>
                          <div className="text-xs text-white/30">{tariff.pricePerKm} ₽/км · от {formatMoney(tariff.minPrice)}</div>
                        </div>
                        {isActive && activeTariffIds.length === 0 && (
                          <span className="text-xs text-emerald-400/70">авто</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {activeTariffIds.length > 0 && (
                  <button
                    onClick={async () => {
                      if (!myProfile) return;
                      await updateDriver.mutateAsync({ id: myProfile.id, data: { activeTariffIds: [] } as any });
                    }}
                    className="mt-2 text-xs text-white/30 hover:text-white/50 transition-colors"
                  >
                    Сбросить (принимать все)
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Active order or waiting */}
        {activeOrder ? (
          <div className="bg-[#0d0d1f] border border-violet-600/20 rounded-3xl overflow-hidden">
            <div className="px-5 pt-4 pb-3 border-b border-white/[0.06]">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-violet-300 uppercase tracking-wider">
                  {activeOrder.status === 'accepted' ? '🚗 Едем к пассажиру' : '▶ Поездка идёт'}
                </span>
                <span className="text-xl font-bold text-white">{formatMoney(activeOrder.price || 0)}</span>
              </div>
            </div>

            <div className="px-5 py-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-2xl bg-violet-600/20 flex items-center justify-center text-violet-300 font-bold text-lg flex-shrink-0">
                  {activeOrder.passengerName?.charAt(0) || 'П'}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-white">{activeOrder.passengerName}</div>
                  <div className="text-xs text-white/40">{activeOrder.passengerPhone}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowChat(true)} className="w-10 h-10 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 flex items-center justify-center transition-colors">
                    <MessageCircle className="w-4 h-4 text-violet-400" />
                  </button>
                  <a href={`tel:${activeOrder.passengerPhone}`} className="w-10 h-10 rounded-xl bg-white/[0.06] hover:bg-white/10 flex items-center justify-center transition-colors">
                    <Phone className="w-4 h-4 text-white/60" />
                  </a>
                </div>
              </div>

              {(activeOrder as any).orderType === 'delivery' && (
                <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                  📦 <span className="font-medium">Доставка</span>
                  {(activeOrder as any).packageDescription && <span className="text-amber-300/70 ml-1">· {(activeOrder as any).packageDescription}</span>}
                </div>
              )}

              <div className="flex items-stretch gap-3 mb-4">
                <div className="flex flex-col items-center py-0.5 gap-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-violet-500" />
                  <div className="flex-1 w-0.5 bg-white/10 min-h-[20px]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <div className="text-xs text-white/30 mb-0.5">Откуда</div>
                    <div className="text-sm text-white">{activeOrder.fromAddress}</div>
                  </div>
                  <div>
                    <div className="text-xs text-white/30 mb-0.5">Куда {activeOrder.toCity ? `(${activeOrder.toCity})` : ''}</div>
                    <div className="text-sm text-white">{activeOrder.toAddress}</div>
                  </div>
                </div>
              </div>

              {activeOrder.comment && (
                <div className="flex items-start gap-2 mb-3 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs text-white/50">
                  💬 <span>{activeOrder.comment}</span>
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={cancelOrder} className="px-4 py-3 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium transition-all flex items-center gap-1.5">
                  <X className="w-4 h-4" /> Отменить
                </button>
                {activeOrder.status === 'accepted' ? (
                  <button onClick={startTrip} disabled={updateOrder.isPending} className="flex-1 py-3 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white font-semibold transition-all flex items-center justify-center gap-2">
                    Начать поездку <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button onClick={completeTrip} disabled={updateOrder.isPending} className="flex-1 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold transition-all flex items-center justify-center gap-2">
                    Завершить <Check className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-[#0d0d1f] border border-white/[0.08] rounded-3xl p-8 text-center">
            {isOnline ? (
              <>
                <div className="w-16 h-16 rounded-2xl bg-violet-600/20 flex items-center justify-center mx-auto mb-4 relative">
                  <Zap className="w-8 h-8 text-violet-400 animate-pulse" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-[#0d0d1f]" />
                </div>
                <p className="text-white/80 font-medium">Ожидаем заказы</p>
                <p className="text-white/40 text-sm mt-1.5">в городе <span className="text-white/70">{workCity}</span></p>
                <p className="text-white/20 text-xs mt-3">Перейдите в «Заказы» чтобы принять</p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                  <Power className="w-8 h-8 text-white/20" />
                </div>
                <p className="text-white/40 font-medium">Вы оффлайн</p>
                <p className="text-white/20 text-sm mt-1">Нажмите кнопку выше, чтобы выйти на линию</p>
              </>
            )}
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[#0d0d1f] border border-white/[0.08] rounded-2xl p-4">
            <div className="flex items-center gap-1.5 mb-2"><Wallet className="w-3.5 h-3.5 text-white/30" /><span className="text-xs text-white/30">Поездок</span></div>
            <div className="text-xl font-bold text-white">{myProfile?.totalRides || 0}</div>
          </div>
          <div className="bg-[#0d0d1f] border border-white/[0.08] rounded-2xl p-4">
            <div className="flex items-center gap-1.5 mb-2"><Star className="w-3.5 h-3.5 text-white/30" /><span className="text-xs text-white/30">Рейтинг</span></div>
            <div className="text-xl font-bold text-amber-400">{myProfile?.rating?.toFixed(1) || '5.0'}</div>
          </div>
          <div className="bg-[#0d0d1f] border border-white/[0.08] rounded-2xl p-4">
            <div className="flex items-center gap-1.5 mb-2"><Car className="w-3.5 h-3.5 text-white/30" /><span className="text-xs text-white/30">Авто</span></div>
            <div className="text-sm font-semibold text-white leading-tight">{myProfile?.carModel || '—'}</div>
            <div className="text-xs text-white/40 mt-0.5">{myProfile?.carNumber || ''}</div>
          </div>
        </div>

        <button
          onClick={() => setShowSupport(true)}
          className="w-full flex items-center gap-3 px-4 py-3.5 bg-[#0d0d1f] border border-white/[0.08] rounded-2xl hover:border-violet-500/20 transition-all"
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
      </div>

      {showChat && activeOrder && <OrderChat orderId={activeOrder.id} onClose={() => setShowChat(false)} />}
      {showSupport && <SupportChat onClose={() => setShowSupport(false)} />}
    </MainLayout>
  );
}
