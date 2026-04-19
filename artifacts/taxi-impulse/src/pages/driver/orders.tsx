import { MainLayout } from "@/components/layout/main-layout";
import { useAuth } from "@/hooks/use-auth";
import { useDriversQuery } from "@/hooks/use-drivers";
import { useOrdersQuery, useUpdateOrderMutation } from "@/hooks/use-orders";
import { formatMoney } from "@/lib/utils";
import { MapPin, Clock, ChevronRight, Zap, AlertCircle, User, Phone, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

function timeAgo(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return `${diff} сек назад`;
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
  return `${Math.floor(diff / 3600)} ч назад`;
}

export default function AvailableOrders() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: drivers } = useDriversQuery();
  const myProfile = drivers?.find(d => d.userId === user?.id);
  const workCity = myProfile?.workCity || myProfile?.city;

  const activeTariffIds: number[] = (myProfile as any)?.activeTariffIds || [];
  const approvedTariffIds: number[] = (myProfile as any)?.approvedTariffIds || [];

  const orderMode: string = (myProfile as any)?.orderMode ?? "all";
  const { data: orders, isLoading } = useOrdersQuery({ status: 'pending' }, 15000);
  const availableOrders = orders?.filter(o => {
    if (o.city !== workCity) return false;
    if (orderMode === "taxi" && (o as any).orderType !== "taxi") return false;
    if (orderMode === "delivery" && (o as any).orderType !== "delivery") return false;
    // If driver has selected specific active tariff classes, only show matching orders
    if (activeTariffIds.length > 0) {
      return o.tariffId ? activeTariffIds.includes(o.tariffId) : true;
    }
    // If no specific selection but has approved tariffs, show orders matching any approved tariff
    if (approvedTariffIds.length > 0) {
      return o.tariffId ? approvedTariffIds.includes(o.tariffId) : true;
    }
    return true;
  });

  const { data: myOrders } = useOrdersQuery({ driverId: myProfile?.id });
  const activeOrder = myOrders?.find(o => ['accepted', 'in_progress'].includes(o.status));

  const updateOrder = useUpdateOrderMutation();

  const handleAccept = async (orderId: number) => {
    if (!myProfile) return;
    if (myProfile.status !== 'online') {
      toast({ title: "Выйдите на линию чтобы принять заказ", variant: "destructive" });
      return;
    }
    if (activeOrder) {
      toast({ title: "Вы уже в поездке. Завершите текущий заказ", variant: "destructive" });
      return;
    }
    try {
      await updateOrder.mutateAsync({ id: orderId, data: { status: 'accepted', driverId: myProfile.id } });
      toast({ title: "Заказ принят! 🚗" });
      window.location.href = "/driver";
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || "";
      if (msg === "subscription_required") {
        toast({ title: "Требуется активная подписка", description: "Оплатите подписку в разделе профиля", variant: "destructive" });
      } else {
        toast({ title: "Заказ уже взяли", variant: "destructive" });
      }
    }
  };

  if (!myProfile) return <MainLayout allowedRoles={['driver']}><div /></MainLayout>;

  return (
    <MainLayout allowedRoles={['driver']}>
      <div className="max-w-2xl mx-auto space-y-4 pb-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Доступные заказы</h1>
            <div className="flex items-center gap-1.5 mt-1 text-sm text-white/40">
              <MapPin className="w-3.5 h-3.5" />
              {workCity || 'Город не выбран'}
            </div>
          </div>
          <div className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border",
            myProfile.status === 'online'
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
              : myProfile.status === 'busy'
              ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
              : "bg-white/5 border-white/10 text-white/40"
          )}>
            {myProfile.status === 'online' && <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />}
            {myProfile.status === 'online' ? 'На линии' : myProfile.status === 'busy' ? 'В поездке' : 'Оффлайн'}
          </div>
        </div>

        {/* Status warnings */}
        {activeOrder && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-3">
            <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span className="text-amber-300 text-sm">Вы сейчас в поездке. Вернитесь на панель для управления.</span>
          </div>
        )}

        {myProfile.status === 'offline' && (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 flex items-center gap-3">
            <AlertCircle className="w-4 h-4 text-white/30 flex-shrink-0" />
            <span className="text-white/40 text-sm">Выйдите на линию на главной странице, чтобы принимать заказы.</span>
          </div>
        )}

        {!workCity && (
          <div className="bg-violet-500/10 border border-violet-500/20 rounded-2xl p-4 flex items-center gap-3">
            <MapPin className="w-4 h-4 text-violet-400 flex-shrink-0" />
            <span className="text-violet-300 text-sm">Выберите город работы в вашем кабинете.</span>
          </div>
        )}

        {/* Orders list */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white/[0.03] rounded-3xl h-40 animate-pulse" />
            ))}
          </div>
        ) : availableOrders?.length === 0 ? (
          <div className="bg-[#0d0d1f] border border-white/[0.08] rounded-3xl p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-white/[0.04] flex items-center justify-center mx-auto mb-4">
              <MapPin className="w-7 h-7 text-white/15" />
            </div>
            <p className="text-white/40 font-medium">Нет заказов</p>
            <p className="text-white/20 text-sm mt-1">в городе {workCity || 'не выбрано'}</p>
            <p className="text-white/15 text-xs mt-3">Обновляется автоматически</p>
          </div>
        ) : (
          <div className="space-y-3">
            {availableOrders?.map(order => (
              <div key={order.id} className="bg-[#0d0d1f] border border-white/[0.08] rounded-3xl overflow-hidden hover:border-violet-500/20 transition-all">
                {/* Price + tariff header */}
                <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/[0.05]">
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-violet-600/20 text-violet-300 px-2.5 py-1 rounded-lg font-medium">
                      {order.tariffName || 'Стандарт'}
                    </span>
                    {order.tariffName?.includes('Бизнес') && (
                      <span className="text-xs bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-lg">
                        Бизнес
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-white">{formatMoney(order.price || 0)}</div>
                    <div className="text-xs text-white/30 flex items-center gap-1 justify-end">
                      <Clock className="w-2.5 h-2.5" />
                      {timeAgo(order.createdAt)}
                    </div>
                  </div>
                </div>

                {/* Route */}
                <div className="px-5 py-4">
                  {/* Delivery badge */}
                  {order.orderType === 'delivery' && (
                    <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                      📦 <span className="font-medium">Доставка</span>
                      {order.packageDescription && <span className="text-amber-300/70 ml-1">· {order.packageDescription}</span>}
                    </div>
                  )}

                  {/* Company badge */}
                  {order.partnerCompany && (
                    <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl bg-violet-500/10 border border-violet-500/20 text-xs text-violet-300">
                      <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="font-medium">{order.partnerCompany}</span>
                    </div>
                  )}

                  {/* Route */}
                  <div className="flex items-stretch gap-3 mb-3">
                    <div className="flex flex-col items-center py-0.5 gap-1">
                      <div className="w-2.5 h-2.5 rounded-full bg-violet-500" />
                      <div className="flex-1 w-0.5 bg-white/[0.08] min-h-[20px]" />
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    </div>
                    <div className="flex-1 space-y-3">
                      <div>
                        <div className="text-xs text-white/30 mb-0.5">Откуда</div>
                        <div className="text-sm text-white line-clamp-1">{order.fromAddress}</div>
                      </div>
                      <div>
                        <div className="text-xs text-white/30 mb-0.5">Куда</div>
                        <div className="text-sm text-white line-clamp-1">{order.toAddress}</div>
                      </div>
                    </div>
                  </div>

                  {/* Passenger info */}
                  <div className="flex items-center gap-4 mb-3 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <div className="flex items-center gap-1.5 text-xs text-white/50">
                      <User className="w-3.5 h-3.5" />
                      <span>{order.passengerName || 'Пассажир'}</span>
                    </div>
                    {order.passengerPhone && (
                      <div className="flex items-center gap-1.5 text-xs text-white/40">
                        <Phone className="w-3.5 h-3.5" />
                        <span>{order.passengerPhone}</span>
                      </div>
                    )}
                  </div>

                  {order.comment && (
                    <div className="flex items-start gap-2 mb-3 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs text-white/50">
                      💬 <span>{order.comment}</span>
                    </div>
                  )}

                  <button
                    onClick={() => handleAccept(order.id)}
                    disabled={updateOrder.isPending || myProfile.status !== 'online' || !!activeOrder}
                    className={cn(
                      "w-full py-3.5 rounded-2xl text-sm font-bold transition-all flex items-center justify-center gap-2",
                      myProfile.status === 'online' && !activeOrder
                        ? "bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-600/25"
                        : "bg-white/[0.04] text-white/20 cursor-not-allowed"
                    )}
                  >
                    {myProfile.status === 'online' && !activeOrder ? (
                      <><Zap className="w-4 h-4" /> Принять заказ <ChevronRight className="w-4 h-4" /></>
                    ) : myProfile.status === 'offline' ? (
                      "Нужно выйти на линию"
                    ) : (
                      "Вы уже в поездке"
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
