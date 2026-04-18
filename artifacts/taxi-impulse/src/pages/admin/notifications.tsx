import { useState } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { useCitiesQuery } from "@/hooks/use-admin";
import { useAuthHeaders } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Bell, Send, Users, Car, User, Globe, Loader2, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

type Role = "all" | "passenger" | "driver";

interface NotificationStats {
  total: number;
  totalPassengers: number;
  totalDrivers: number;
  byCity: Record<string, { passengers: number; drivers: number; total: number }>;
}

function useNotificationStats() {
  const authHeaders = useAuthHeaders();
  return useQuery<NotificationStats>({
    queryKey: ["/api/notifications/stats"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/notifications/stats`, { headers: authHeaders.headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Ошибка загрузки статистики");
      return data;
    },
    retry: 1,
  });
}

export default function AdminNotifications() {
  const { data: cities } = useCitiesQuery();
  const { data: stats, isLoading: statsLoading, isError: statsError, refetch: refetchStats } = useNotificationStats();
  const authHeaders = useAuthHeaders();
  const { toast } = useToast();

  const [selectedCity, setSelectedCity] = useState<string>("");
  const [role, setRole] = useState<Role>("all");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [lastResult, setLastResult] = useState<{ queued: number } | null>(null);

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) {
      toast({ title: "Заполните заголовок и текст", variant: "destructive" });
      return;
    }

    const confirmed = window.confirm(
      `Отправить уведомление${selectedCity ? ` для города «${selectedCity}»` : " всем городам"}?\n\nПолучатели: ${roleLabel(role)}\n\n«${title}»\n${body}`
    );
    if (!confirmed) return;

    setIsSending(true);
    setLastResult(null);
    try {
      const res = await fetch(`${BASE}/api/notifications/broadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders.headers },
        body: JSON.stringify({
          city: selectedCity || null,
          role,
          title: title.trim(),
          body: body.trim(),
        }),
      });
      const data = await res.json() as any;
      if (!res.ok) throw new Error(data.error || "Ошибка отправки");
      setLastResult({ queued: data.queued ?? 0 });
      toast({ title: `✅ Рассылка запущена — ${data.queued ?? 0} получателей` });
      refetchStats();
    } catch (err: any) {
      toast({ title: err.message || "Ошибка отправки", variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  const handleClear = () => {
    setTitle("");
    setBody("");
    setLastResult(null);
  };

  function roleLabel(r: Role) {
    if (r === "all") return "Все (пассажиры + водители)";
    if (r === "passenger") return "Пассажиры";
    return "Водители";
  }

  function getCityStats() {
    const byCity = stats?.byCity ?? {};
    if (!selectedCity) {
      return { passengers: stats?.totalPassengers ?? 0, drivers: stats?.totalDrivers ?? 0, total: stats?.total ?? 0 };
    }
    return byCity[selectedCity] ?? { passengers: 0, drivers: 0, total: 0 };
  }

  const cityStats = getCityStats();
  const recipientCount =
    role === "all" ? cityStats.total :
    role === "passenger" ? cityStats.passengers :
    cityStats.drivers;

  const fieldCls = "w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 placeholder:text-white/20";

  const byCity = stats?.byCity ?? {};
  const byCityEntries = Object.entries(byCity).sort((a, b) => b[1].total - a[1].total);

  return (
    <MainLayout allowedRoles={["admin"]}>
      <div className="max-w-2xl mx-auto space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-white">Рассылка уведомлений</h1>
          <p className="text-sm text-white/40 mt-1">Push-уведомления для пользователей приложения</p>
        </div>

        {/* Статистика подписок */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Всего подписок", value: stats?.total ?? 0, icon: Bell, color: "text-violet-400", bg: "bg-violet-600/10" },
            { label: "Пассажиры", value: stats?.totalPassengers ?? 0, icon: User, color: "text-sky-400", bg: "bg-sky-600/10" },
            { label: "Водители", value: stats?.totalDrivers ?? 0, icon: Car, color: "text-emerald-400", bg: "bg-emerald-600/10" },
          ].map(item => (
            <div key={item.label} className="bg-[#0d0d1f] border border-white/[0.08] rounded-2xl p-4 flex items-center gap-3">
              <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", item.bg)}>
                {statsLoading
                  ? <Loader2 className={cn("w-4 h-4 animate-spin", item.color)} />
                  : <item.icon className={cn("w-4 h-4", item.color)} />
                }
              </div>
              <div>
                <div className="text-xl font-bold text-white">{statsLoading ? "—" : item.value}</div>
                <div className="text-xs text-white/40">{item.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Ошибка загрузки статистики */}
        {statsError && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/5 border border-red-500/15">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="text-sm text-red-300 flex-1">Не удалось загрузить статистику</span>
            <button
              onClick={() => refetchStats()}
              className="flex items-center gap-1 text-xs text-white/40 hover:text-white/60 transition-colors"
            >
              <RefreshCw className="w-3 h-3" /> Обновить
            </button>
          </div>
        )}

        {/* Форма рассылки */}
        <div className="bg-[#0d0d1f] border border-white/[0.08] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-2">
            <Send className="w-4 h-4 text-violet-400" />
            <span className="text-sm font-semibold text-white">Новая рассылка</span>
          </div>

          <div className="p-5 space-y-4">
            {/* Город */}
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Город</label>
              <select
                value={selectedCity}
                onChange={e => setSelectedCity(e.target.value)}
                className={fieldCls}
                style={{ appearance: "none", backgroundImage: "none" }}
              >
                <option value="">Все города</option>
                {Array.isArray(cities) && cities.map((c: any) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Получатели */}
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Получатели</label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: "all", label: "Все", icon: Users },
                  { value: "passenger", label: "Пассажиры", icon: User },
                  { value: "driver", label: "Водители", icon: Car },
                ] as const).map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setRole(opt.value)}
                    className={cn(
                      "flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border transition-all",
                      role === opt.value
                        ? "bg-violet-600/20 border-violet-600/30 text-violet-300"
                        : "bg-white/[0.03] border-white/[0.08] text-white/40 hover:text-white/60"
                    )}
                  >
                    <opt.icon className="w-3.5 h-3.5" />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Заголовок */}
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Заголовок уведомления *</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Например: Акция! Скидка 20%"
                maxLength={80}
                className={fieldCls}
              />
              <div className="text-xs text-white/20 mt-1 text-right">{title.length}/80</div>
            </div>

            {/* Текст */}
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Текст сообщения *</label>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Текст push-уведомления..."
                maxLength={200}
                rows={3}
                className={cn(fieldCls, "resize-none")}
              />
              <div className="text-xs text-white/20 mt-1 text-right">{body.length}/200</div>
            </div>

            {/* Превью получателей */}
            <div className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl border text-sm transition-all",
              recipientCount > 0
                ? "bg-violet-600/5 border-violet-600/15 text-violet-300/80"
                : "bg-white/[0.02] border-white/[0.06] text-white/30"
            )}>
              <Globe className="w-4 h-4 shrink-0" />
              <span>
                {selectedCity ? `${selectedCity}` : "Все города"} ·{" "}
                {roleLabel(role)} ·{" "}
                <span className="font-semibold text-white">{recipientCount}</span>{" "}
                получател{recipientCount === 1 ? "ь" : recipientCount % 10 >= 2 && recipientCount % 10 <= 4 && (recipientCount % 100 < 10 || recipientCount % 100 >= 20) ? "я" : "ей"}
              </span>
            </div>

            {/* Результат последней отправки */}
            {lastResult && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-sm text-emerald-300">
                  Рассылка запущена ·{" "}
                  <b>{lastResult.queued}</b> получателей в очереди
                </span>
              </div>
            )}

            {/* Кнопки */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSend}
                disabled={isSending || !title.trim() || !body.trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
              >
                {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {isSending ? "Запуск..." : "Отправить"}
              </button>
              <button
                onClick={handleClear}
                disabled={isSending}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] text-white/50 text-sm transition-colors"
              >
                Очистить
              </button>
            </div>
          </div>
        </div>

        {/* По городам */}
        {byCityEntries.length > 0 && (
          <div className="bg-[#0d0d1f] border border-white/[0.08] rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center gap-2">
              <Users className="w-4 h-4 text-white/40" />
              <span className="text-sm font-medium text-white/60">Подписки по городам</span>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {byCityEntries.map(([city, s]) => (
                <div key={city} className="px-5 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white">{city}</div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-white/40">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />{s.passengers}
                    </span>
                    <span className="flex items-center gap-1">
                      <Car className="w-3 h-3" />{s.drivers}
                    </span>
                    <span className="text-white/60 font-medium w-6 text-right">{s.total}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
