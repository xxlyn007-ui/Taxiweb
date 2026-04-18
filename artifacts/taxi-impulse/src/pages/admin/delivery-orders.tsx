import { useState } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { useAuthHeaders } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Plus, Package, CheckCircle, XCircle, Clock, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

function formatMoney(v: number) { return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(v); }
function formatDate(d: any) { return d ? new Date(d).toLocaleString("ru-RU") : "—"; }

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "Ожидает", color: "text-amber-400 bg-amber-500/10" },
  accepted: { label: "Принят", color: "text-blue-400 bg-blue-500/10" },
  in_progress: { label: "В пути", color: "text-violet-400 bg-violet-500/10" },
  completed: { label: "Выполнен", color: "text-emerald-400 bg-emerald-500/10" },
  cancelled: { label: "Отменён", color: "text-red-400 bg-red-500/10" },
};

export default function DeliveryOrders() {
  const auth = useAuthHeaders();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [form, setForm] = useState({
    fromAddress: "", toAddress: "", city: "", price: "", comment: "",
    packageDescription: "", recipientPhone: "", senderPhone: "", scheduledAt: "", partnerCompany: "",
  });

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["/api/delivery/orders"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/delivery/orders`, { headers: auth.headers });
      if (!r.ok) throw new Error("Ошибка загрузки");
      return r.json();
    },
    refetchInterval: 15000,
  });

  const { data: stats } = useQuery({
    queryKey: ["/api/delivery/stats"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/delivery/stats`, { headers: auth.headers });
      if (!r.ok) return null;
      return r.json();
    },
    refetchInterval: 30000,
  });

  const createMut = useMutation({
    mutationFn: async (data: typeof form) => {
      const r = await fetch(`${BASE}/api/delivery/orders`, {
        method: "POST", headers: { ...auth.headers, "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, price: data.price ? parseFloat(data.price) : undefined }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || "Ошибка"); }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/delivery/orders"] });
      qc.invalidateQueries({ queryKey: ["/api/delivery/stats"] });
      setShowForm(false);
      setForm({ fromAddress: "", toAddress: "", city: "", price: "", comment: "", packageDescription: "", recipientPhone: "", senderPhone: "", scheduledAt: "", partnerCompany: "" });
      toast({ title: "Заказ создан и отправлен водителям" });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const r = await fetch(`${BASE}/api/delivery/orders/${id}`, {
        method: "PATCH", headers: { ...auth.headers, "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!r.ok) throw new Error("Ошибка");
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/delivery/orders"] }); qc.invalidateQueries({ queryKey: ["/api/delivery/stats"] }); toast({ title: "Статус обновлён" }); },
    onError: () => toast({ title: "Ошибка обновления", variant: "destructive" }),
  });

  const filtered = (orders as any[]).filter((o: any) => filterStatus === "all" || o.status === filterStatus);

  return (
    <MainLayout allowedRoles={["admin", "delivery_admin", "city_admin"]}>
      <div className="max-w-4xl space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Заказы доставки</h1>
            <p className="text-sm text-white/40 mt-0.5">Управление заказами доставки за сутки</p>
          </div>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> Новый заказ
          </button>
        </div>

        {/* Статистика */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { label: "Всего сегодня", value: stats.total, color: "text-white" },
              { label: "Выполнено", value: stats.completed, color: "text-emerald-400" },
              { label: "Отменено", value: stats.cancelled, color: "text-red-400" },
              { label: "Ожидают", value: stats.pending, color: "text-amber-400" },
              { label: "Выручка", value: formatMoney(stats.totalRevenue || 0), color: "text-violet-400" },
            ].map(s => (
              <div key={s.label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
                <div className="text-xs text-white/40 mb-1">{s.label}</div>
                <div className={cn("text-lg font-bold", s.color)}>{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Форма создания */}
        {showForm && (
          <div className="bg-white/[0.03] border border-violet-500/30 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">Новый заказ доставки</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: "city", label: "Город", placeholder: "Красноярск" },
                { key: "fromAddress", label: "Адрес откуда", placeholder: "ул. Ленина, 1" },
                { key: "toAddress", label: "Адрес куда", placeholder: "ул. Мира, 5" },
                { key: "price", label: "Сумма доставки (₽)", placeholder: "500" },
                { key: "scheduledAt", label: "Время забрать (необязательно)", placeholder: "", type: "datetime-local" },
                { key: "partnerCompany", label: "Партнёрская компания", placeholder: "Если есть" },
                { key: "packageDescription", label: "Описание груза", placeholder: "Документы, коробка..." },
                { key: "senderPhone", label: "Тел. заказчика (необязательно)", placeholder: "+7..." },
                { key: "recipientPhone", label: "Тел. получателя (необязательно)", placeholder: "+7..." },
              ].map(field => (
                <div key={field.key} className={field.key === "packageDescription" ? "col-span-2" : ""}>
                  <label className="text-xs text-white/40 mb-1 block">{field.label}</label>
                  <input
                    type={field.type || "text"}
                    value={(form as any)[field.key]}
                    onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-violet-500"
                    placeholder={field.placeholder}
                  />
                </div>
              ))}
              <div className="col-span-2">
                <label className="text-xs text-white/40 mb-1 block">Комментарий</label>
                <textarea value={form.comment} onChange={e => setForm(f => ({ ...f, comment: e.target.value }))}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-violet-500 h-20 resize-none"
                  placeholder="Дополнительная информация о заказе..." />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => createMut.mutate(form)} disabled={createMut.isPending}
                className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium disabled:opacity-50 transition-colors">
                {createMut.isPending ? "Создание..." : "Создать заказ"}
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl bg-white/[0.05] text-white/60 text-sm hover:text-white transition-colors">
                Отмена
              </button>
            </div>
          </div>
        )}

        {/* Фильтр */}
        <div className="flex gap-1 flex-wrap">
          {["all", "pending", "accepted", "in_progress", "completed", "cancelled"].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                filterStatus === s ? "bg-violet-600 text-white" : "bg-white/[0.03] text-white/40 hover:text-white/70")}>
              {s === "all" ? "Все" : STATUS_LABELS[s]?.label || s}
            </button>
          ))}
        </div>

        {/* Список заказов */}
        {isLoading ? (
          <div className="text-white/30 text-sm text-center py-8">Загрузка...</div>
        ) : filtered.length === 0 ? (
          <div className="text-white/30 text-sm text-center py-8">Нет заказов</div>
        ) : (
          <div className="space-y-2">
            {filtered.map((o: any) => (
              <div key={o.id} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", STATUS_LABELS[o.status]?.color || "text-white/40")}>
                        {STATUS_LABELS[o.status]?.label || o.status}
                      </span>
                      {o.partnerCompany && <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">🏢 {o.partnerCompany}</span>}
                      <span className="text-xs text-white/30">#{o.id} · {formatDate(o.createdAt)}</span>
                    </div>
                    <div className="text-sm text-white font-medium">{o.fromAddress} → {o.toAddress}</div>
                    <div className="flex items-center gap-4 text-xs text-white/40 flex-wrap">
                      <span>📍 {o.city}</span>
                      {o.price && <span className="text-violet-400 font-semibold">{formatMoney(o.price)}</span>}
                      {o.packageDescription && <span>📦 {o.packageDescription}</span>}
                      {o.senderPhone && <span>📞 Зак: {o.senderPhone}</span>}
                      {o.recipientPhone && <span>📞 Пол: {o.recipientPhone}</span>}
                    </div>
                    {o.driverName && (
                      <div className="text-xs text-white/50">
                        Водитель: {o.driverName} · {o.driverPhone} · {o.driverCar} {o.driverCarNumber}
                      </div>
                    )}
                  </div>
                  {["pending", "accepted", "in_progress"].includes(o.status) && (
                    <div className="flex gap-1 shrink-0">
                      {o.status === "pending" && (
                        <button onClick={() => updateMut.mutate({ id: o.id, status: "accepted" })}
                          className="p-2 rounded-xl text-blue-400 hover:bg-blue-500/10 transition-colors" title="Принять">
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                      {["accepted", "in_progress"].includes(o.status) && (
                        <button onClick={() => updateMut.mutate({ id: o.id, status: "completed" })}
                          className="p-2 rounded-xl text-emerald-400 hover:bg-emerald-500/10 transition-colors" title="Выполнен">
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => updateMut.mutate({ id: o.id, status: "cancelled" })}
                        className="p-2 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors" title="Отменить">
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
