import { MainLayout } from "@/components/layout/main-layout";
import { useAuth, useAuthHeaders } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { formatMoney, cn } from "@/lib/utils";
import { Loader2, Clock, User, Car, MapPin } from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

function useOrdersFiltered(city?: string, todayOnly?: boolean) {
  const auth = useAuthHeaders();
  const params = new URLSearchParams();
  if (city) params.set("city", city);
  if (todayOnly) params.set("today", "1");
  const qs = params.toString();
  return useQuery({
    queryKey: ["/api/orders/filtered", city, todayOnly],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/orders${qs ? "?" + qs : ""}`, { headers: auth.headers });
      if (!r.ok) throw new Error("Ошибка загрузки");
      return r.json() as Promise<any[]>;
    },
    refetchInterval: 30000,
  });
}

function getStatusBadge(status: string) {
  switch (status) {
    case "pending": return <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded-full text-xs">Поиск</span>;
    case "accepted": return <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full text-xs">Принят</span>;
    case "in_progress": return <span className="px-2 py-0.5 bg-violet-500/20 text-violet-400 rounded-full text-xs">В пути</span>;
    case "completed": return <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full text-xs">Выполнен</span>;
    case "cancelled": return <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full text-xs">Отменён</span>;
    default: return null;
  }
}

export default function AdminOrders() {
  const { user } = useAuth();
  const isCityAdmin = user?.role === "city_admin";
  const managedCity: string | undefined = isCityAdmin ? (user as any).managedCity ?? undefined : undefined;

  const { data: orders, isLoading } = useOrdersFiltered(managedCity, isCityAdmin);

  const completedOrders = orders?.filter((o: any) => o.status === "completed") || [];
  const totalRevenue = completedOrders.reduce((sum: number, o: any) => sum + (o.price || 0), 0);

  const formatTime = (dt: any) => {
    if (!dt) return "—";
    try { return new Date(dt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }); }
    catch { return "—"; }
  };

  const formatDateTime = (dt: any) => {
    if (!dt) return "—";
    try { return new Date(dt).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); }
    catch { return "—"; }
  };

  return (
    <MainLayout allowedRoles={["admin", "city_admin"]}>
      <div className="space-y-5 max-w-5xl">
        <div>
          <h1 className="text-xl font-bold text-white">
            {isCityAdmin ? `История заказов — ${managedCity || "ваш город"}` : "Управление заказами"}
          </h1>
          <p className="text-sm text-white/40 mt-0.5">
            {isCityAdmin ? "Все заказы за сегодня в вашем городе" : "Все заказы платформы"}
          </p>
        </div>

        {isCityAdmin && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
              <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Заказов сегодня</div>
              <div className="text-2xl font-bold text-white">{orders?.length ?? 0}</div>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
              <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Выполнено</div>
              <div className="text-2xl font-bold text-emerald-400">{completedOrders.length}</div>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
              <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Выручка</div>
              <div className="text-2xl font-bold text-amber-400">{formatMoney(totalRevenue)}</div>
            </div>
          </div>
        )}

        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
          {isLoading ? (
            <div className="py-16 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
            </div>
          ) : !orders?.length ? (
            <div className="py-16 text-center text-white/30 text-sm">
              {isCityAdmin ? "Заказов за сегодня нет" : "Заказов нет"}
            </div>
          ) : isCityAdmin ? (
            <div className="divide-y divide-white/[0.04]">
              <div className="grid grid-cols-12 px-4 py-3 text-xs text-white/30 uppercase tracking-wider">
                <span className="col-span-1">#</span>
                <span className="col-span-2">Время</span>
                <span className="col-span-2">Пассажир</span>
                <span className="col-span-2">Водитель</span>
                <span className="col-span-3">Маршрут</span>
                <span className="col-span-1">Статус</span>
                <span className="col-span-1 text-right">Сумма</span>
              </div>
              {orders.map((order: any) => (
                <div key={order.id} className="grid grid-cols-12 px-4 py-3.5 items-center hover:bg-white/[0.02] transition-colors">
                  <div className="col-span-1 text-white/40 text-xs">#{order.id}</div>
                  <div className="col-span-2 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-white/30 flex-shrink-0" />
                    <span className="text-xs text-white/50">{formatTime(order.createdAt)}</span>
                  </div>
                  <div className="col-span-2">
                    <div className="flex items-center gap-1">
                      <User className="w-3 h-3 text-blue-400/60 flex-shrink-0" />
                      <span className="text-xs text-white/70 truncate">{order.passengerPhone || "—"}</span>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <div className="flex items-center gap-1">
                      <Car className="w-3 h-3 text-violet-400/60 flex-shrink-0" />
                      <span className={cn("text-xs truncate", order.driverPhone ? "text-violet-300" : "text-white/30")}>
                        {order.driverPhone || "Нет"}
                      </span>
                    </div>
                  </div>
                  <div className="col-span-3">
                    <div className="flex items-start gap-1">
                      <MapPin className="w-3 h-3 text-white/30 flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-xs text-white/70 truncate">{order.fromAddress}</div>
                        <div className="text-xs text-white/40 truncate">→ {order.toAddress}</div>
                      </div>
                    </div>
                  </div>
                  <div className="col-span-1">{getStatusBadge(order.status)}</div>
                  <div className="col-span-1 text-right">
                    <span className={cn("text-sm font-semibold", order.status === "completed" ? "text-emerald-400" : "text-white/40")}>
                      {order.price ? formatMoney(order.price) : "—"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/5 text-white/40 border-b border-white/10">
                  <tr>
                    <th className="px-6 py-4 font-medium">ID / Дата</th>
                    <th className="px-6 py-4 font-medium">Маршрут</th>
                    <th className="px-6 py-4 font-medium">Клиент / Водитель</th>
                    <th className="px-6 py-4 font-medium">Статус</th>
                    <th className="px-6 py-4 font-medium text-right">Сумма</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {orders.map((order: any) => (
                    <tr key={order.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium">#{order.id}</div>
                        <div className="text-xs text-white/40">{formatDateTime(order.createdAt)}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          {(order as any).orderType === "delivery" && <span className="text-[10px] bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded-full">📦 Доставка</span>}
                          <div className="max-w-[190px] truncate font-medium text-sm">{order.fromAddress}</div>
                        </div>
                        <div className="text-xs text-white/40 max-w-[200px] truncate">→ {order.toAddress}</div>
                        {order.comment && <div className="text-xs text-white/30 max-w-[200px] truncate mt-0.5">💬 {order.comment}</div>}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm">{order.passengerPhone}</div>
                        <div className="text-xs text-violet-400">{order.driverPhone || "Нет водителя"}</div>
                      </td>
                      <td className="px-6 py-4">{getStatusBadge(order.status)}</td>
                      <td className="px-6 py-4 text-right font-medium">{formatMoney(order.price || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
