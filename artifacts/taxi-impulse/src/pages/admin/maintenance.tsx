import { useState } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { useAuthHeaders } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Server, Trash2, RefreshCw, Database, Activity, Cpu, HardDrive,
  Users, Car, ShoppingBag, Bell, MessageSquare, HeadphonesIcon,
  CheckCircle, AlertTriangle, Clock, Zap, CreditCard, TestTube2
} from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

function useMaintenanceStats() {
  const authHeaders = useAuthHeaders();
  return useQuery({
    queryKey: ["/api/admin/maintenance/stats"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/admin/maintenance/stats`, { headers: authHeaders.headers });
      if (!r.ok) throw new Error("Ошибка загрузки статистики");
      return r.json();
    },
    refetchInterval: 30000,
  });
}

function useCleanupMutation(path: string) {
  const authHeaders = useAuthHeaders();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body?: object) => {
      const r = await fetch(`${BASE}/api/admin/maintenance/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders.headers },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || "Ошибка"); }
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/admin/maintenance/stats"] }),
  });
}

function StatCard({ icon: Icon, label, value, sub, color = "violet" }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color?: string;
}) {
  const colors: Record<string, string> = {
    violet: "text-violet-400 bg-violet-600/10",
    emerald: "text-emerald-400 bg-emerald-500/10",
    amber: "text-amber-400 bg-amber-500/10",
    blue: "text-blue-400 bg-blue-500/10",
    rose: "text-rose-400 bg-rose-500/10",
  };
  const cls = colors[color] || colors.violet;
  return (
    <div className="bg-[#0d0d1f] border border-white/[0.08] rounded-2xl p-4 flex items-center gap-3">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", cls)}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-white/30 truncate">{label}</div>
        <div className="text-lg font-bold text-white">{value}</div>
        {sub && <div className="text-xs text-white/40">{sub}</div>}
      </div>
    </div>
  );
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 24) return `${Math.floor(h / 24)}д ${h % 24}ч`;
  return `${h}ч ${m}м`;
}

function useAdminPostMutation(path: string) {
  const authHeaders = useAuthHeaders();
  return useMutation({
    mutationFn: async (body?: object) => {
      const r = await fetch(`${BASE}/api/admin/maintenance/${path}`, {
        method: "POST",
        headers: { ...authHeaders.headers, "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || "Ошибка"); }
      return r.json();
    },
  });
}

export default function AdminMaintenancePage() {
  const { toast } = useToast();
  const { data: stats, isLoading, refetch } = useMaintenanceStats();
  const [cleanupDays, setCleanupDays] = useState(30);
  const [supportDays, setSupportDays] = useState(90);
  const [subPhone, setSubPhone] = useState("");
  const [subHours, setSubHours] = useState(2);
  const [activatePhone, setActivatePhone] = useState("");
  const [activateDays, setActivateDays] = useState(30);

  const cleanupOrders = useCleanupMutation("cleanup-orders");
  const cleanupRideshares = useCleanupMutation("cleanup-rideshares");
  const cleanupPush = useCleanupMutation("cleanup-push");
  const fixPushCities = useCleanupMutation("fix-push-cities");
  const cleanupSupport = useCleanupMutation("cleanup-support");
  const expireSub = useAdminPostMutation("expire-subscription");
  const activateSub = useAdminPostMutation("activate-subscription");

  const runCleanup = async (
    mutation: ReturnType<typeof useCleanupMutation>,
    label: string,
    body?: object
  ) => {
    try {
      const result = await mutation.mutateAsync(body);
      toast({ title: `✅ ${label}`, description: result.message || `Удалено: ${result.deleted ?? "—"}` });
    } catch (e: any) {
      toast({ title: `Ошибка: ${label}`, description: e.message, variant: "destructive" });
    }
  };

  return (
    <MainLayout allowedRoles={["admin"]}>
      <div className="max-w-3xl mx-auto space-y-6 pb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Server className="w-5 h-5 text-violet-400" /> Обслуживание сервера
            </h1>
            <p className="text-sm text-white/40 mt-0.5">Статистика, очистка данных и мониторинг</p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.05] hover:bg-white/10 text-white/60 text-sm transition-all"
          >
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
            Обновить
          </button>
        </div>

        {/* Server Health */}
        {stats && (
          <div className="bg-[#0d0d1f] border border-white/[0.08] rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-semibold text-white">Состояние сервера</span>
              <span className="ml-auto flex items-center gap-1 text-xs text-emerald-400">
                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" /> Работает
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white/[0.03] rounded-xl p-3 text-center">
                <Clock className="w-4 h-4 text-blue-400 mx-auto mb-1" />
                <div className="text-sm font-bold text-white">{formatUptime(stats.uptime)}</div>
                <div className="text-xs text-white/30">Аптайм</div>
              </div>
              <div className="bg-white/[0.03] rounded-xl p-3 text-center">
                <Cpu className="w-4 h-4 text-violet-400 mx-auto mb-1" />
                <div className="text-sm font-bold text-white">{stats.memoryMb} MB</div>
                <div className="text-xs text-white/30">Память (heap)</div>
              </div>
              <div className="bg-white/[0.03] rounded-xl p-3 text-center">
                <Zap className="w-4 h-4 text-amber-400 mx-auto mb-1" />
                <div className="text-sm font-bold text-white">{stats.nodeVersion}</div>
                <div className="text-xs text-white/30">Node.js</div>
              </div>
            </div>
          </div>
        )}

        {/* Database Stats */}
        <div>
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3 px-1">
            <Database className="w-4 h-4 inline mr-2 opacity-60" />База данных
          </h2>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : stats ? (
            <div className="grid grid-cols-2 gap-3">
              <StatCard icon={Users} label="Пользователей" value={stats.users} color="violet" />
              <StatCard icon={Car} label="Водителей" value={stats.drivers} color="blue" />
              <StatCard
                icon={ShoppingBag}
                label="Заказов всего"
                value={stats.orders?.total ?? 0}
                sub={`Активных: ${stats.orders?.active ?? 0}`}
                color="emerald"
              />
              <StatCard
                icon={Car}
                label="Попутки"
                value={stats.rideshares ?? 0}
                color="amber"
              />
              <StatCard
                icon={CheckCircle}
                label="Подписки"
                value={stats.subscriptions?.total ?? 0}
                sub={`Активных: ${stats.subscriptions?.active ?? 0}`}
                color="emerald"
              />
              <StatCard icon={Bell} label="Push-подписки" value={stats.pushSubscriptions ?? 0} color="blue" />
              <StatCard icon={MessageSquare} label="Сообщения чата" value={stats.chatMessages ?? 0} color="violet" />
              <StatCard icon={HeadphonesIcon} label="Сообщения поддержки" value={stats.supportMessages ?? 0} color="rose" />
            </div>
          ) : (
            <div className="bg-[#0d0d1f] border border-red-500/20 rounded-2xl p-6 text-center">
              <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
              <p className="text-white/40 text-sm">Не удалось загрузить статистику</p>
            </div>
          )}
        </div>

        {/* Cleanup Section */}
        <div>
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3 px-1">
            <HardDrive className="w-4 h-4 inline mr-2 opacity-60" />Очистка данных
          </h2>
          <div className="space-y-3">

            {/* Orders cleanup */}
            <div className="bg-[#0d0d1f] border border-white/[0.08] rounded-2xl p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-sm font-semibold text-white">Старые заказы</div>
                  <div className="text-xs text-white/40 mt-0.5">
                    Удалить завершённые и отменённые заказы старше N дней (вместе с чатом)
                  </div>
                </div>
                <ShoppingBag className="w-4 h-4 text-white/20 shrink-0 mt-0.5" />
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 flex-1">
                  <label className="text-xs text-white/40 whitespace-nowrap">Старше (дней):</label>
                  <input
                    type="number"
                    value={cleanupDays}
                    onChange={e => setCleanupDays(Math.max(1, parseInt(e.target.value) || 30))}
                    min="1"
                    className="w-20 bg-white/[0.05] border border-white/[0.08] rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none"
                  />
                </div>
                <button
                  onClick={() => runCleanup(cleanupOrders, "Очистка заказов", { days: cleanupDays })}
                  disabled={cleanupOrders.isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-sm font-medium transition-all disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {cleanupOrders.isPending ? "Очистка..." : "Очистить"}
                </button>
              </div>
            </div>

            {/* Rideshares cleanup */}
            <div className="bg-[#0d0d1f] border border-white/[0.08] rounded-2xl p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-sm font-semibold text-white">Истёкшие попутки</div>
                  <div className="text-xs text-white/40 mt-0.5">
                    Удалить отменённые и завершённые попутки с их сообщениями
                  </div>
                </div>
                <Car className="w-4 h-4 text-white/20 shrink-0 mt-0.5" />
              </div>
              <button
                onClick={() => runCleanup(cleanupRideshares, "Очистка попуток")}
                disabled={cleanupRideshares.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-sm font-medium transition-all disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {cleanupRideshares.isPending ? "Очистка..." : "Очистить попутки"}
              </button>
            </div>

            {/* Push cleanup */}
            <div className="bg-[#0d0d1f] border border-white/[0.08] rounded-2xl p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-sm font-semibold text-white">Push-подписки</div>
                  <div className="text-xs text-white/40 mt-0.5">
                    Удалить «мёртвые» push-подписки (устройства без пользователей или с истёкшим токеном)
                  </div>
                </div>
                <Bell className="w-4 h-4 text-white/20 shrink-0 mt-0.5" />
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => runCleanup(cleanupPush, "Очистка push-подписок")}
                  disabled={cleanupPush.isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 text-sm font-medium transition-all disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {cleanupPush.isPending ? "Очистка..." : "Очистить push"}
                </button>
                <button
                  onClick={() => runCleanup(fixPushCities, "Восстановление городов")}
                  disabled={fixPushCities.isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 text-sm font-medium transition-all disabled:opacity-50"
                >
                  <Bell className="w-3.5 h-3.5" />
                  {fixPushCities.isPending ? "Восстановление..." : "Восстановить города"}
                </button>
              </div>
            </div>

            {/* Support cleanup */}
            <div className="bg-[#0d0d1f] border border-white/[0.08] rounded-2xl p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-sm font-semibold text-white">Сообщения поддержки</div>
                  <div className="text-xs text-white/40 mt-0.5">
                    Удалить старые тикеты поддержки старше N дней
                  </div>
                </div>
                <HeadphonesIcon className="w-4 h-4 text-white/20 shrink-0 mt-0.5" />
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 flex-1">
                  <label className="text-xs text-white/40 whitespace-nowrap">Старше (дней):</label>
                  <input
                    type="number"
                    value={supportDays}
                    onChange={e => setSupportDays(Math.max(1, parseInt(e.target.value) || 90))}
                    min="1"
                    className="w-20 bg-white/[0.05] border border-white/[0.08] rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none"
                  />
                </div>
                <button
                  onClick={() => runCleanup(cleanupSupport, "Очистка поддержки", { days: supportDays })}
                  disabled={cleanupSupport.isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-sm font-medium transition-all disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {cleanupSupport.isPending ? "Очистка..." : "Очистить"}
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* Subscription testing */}
        <div>
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3 px-1">
            <TestTube2 className="w-4 h-4 inline mr-2 opacity-60" />Тестирование подписки
          </h2>
          <div className="space-y-3">

            {/* Expire subscription */}
            <div className="bg-[#0d0d1f] border border-amber-500/20 rounded-2xl p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-sm font-semibold text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-400" />
                    Сделать подписку истекающей
                  </div>
                  <div className="text-xs text-white/40 mt-0.5">
                    Установить срок окончания через N часов — для проверки продления оплатой
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Телефон водителя (78003504656)"
                  value={subPhone}
                  onChange={e => setSubPhone(e.target.value)}
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/40"
                />
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 flex-1">
                    <label className="text-xs text-white/40 whitespace-nowrap">Через (ч):</label>
                    <input
                      type="number"
                      value={subHours}
                      min="0"
                      onChange={e => setSubHours(Math.max(0, parseInt(e.target.value) || 2))}
                      className="w-20 bg-white/[0.05] border border-white/[0.08] rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none"
                    />
                  </div>
                  <button
                    disabled={!subPhone.trim() || expireSub.isPending}
                    onClick={async () => {
                      try {
                        const r = await expireSub.mutateAsync({ phone: subPhone.trim(), hoursLeft: subHours });
                        toast({ title: "✅ Подписка изменена", description: r.message });
                      } catch (e: any) {
                        toast({ title: "Ошибка", description: e.message, variant: "destructive" });
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-sm font-medium transition-all disabled:opacity-40"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    {expireSub.isPending ? "Применяю..." : "Применить"}
                  </button>
                </div>
              </div>
            </div>

            {/* Activate subscription */}
            <div className="bg-[#0d0d1f] border border-emerald-500/20 rounded-2xl p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-sm font-semibold text-white flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-emerald-400" />
                    Активировать подписку вручную
                  </div>
                  <div className="text-xs text-white/40 mt-0.5">
                    Продлить подписку водителя на N дней без оплаты
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Телефон водителя (78003504656)"
                  value={activatePhone}
                  onChange={e => setActivatePhone(e.target.value)}
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500/40"
                />
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 flex-1">
                    <label className="text-xs text-white/40 whitespace-nowrap">На (дней):</label>
                    <input
                      type="number"
                      value={activateDays}
                      min="1"
                      onChange={e => setActivateDays(Math.max(1, parseInt(e.target.value) || 30))}
                      className="w-20 bg-white/[0.05] border border-white/[0.08] rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none"
                    />
                  </div>
                  <button
                    disabled={!activatePhone.trim() || activateSub.isPending}
                    onClick={async () => {
                      try {
                        const r = await activateSub.mutateAsync({ phone: activatePhone.trim(), days: activateDays });
                        toast({ title: "✅ Подписка активирована", description: `${r.driverName} — до ${new Date(r.endDate).toLocaleDateString("ru")}` });
                      } catch (e: any) {
                        toast({ title: "Ошибка", description: e.message, variant: "destructive" });
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-sm font-medium transition-all disabled:opacity-40"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    {activateSub.isPending ? "Активирую..." : "Активировать"}
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>

        <p className="text-xs text-white/20 text-center px-4">
          Очистка данных необратима. Удалённые записи восстановить невозможно.
          Рекомендуется делать резервные копии базы данных перед очисткой.
        </p>
      </div>
    </MainLayout>
  );
}
