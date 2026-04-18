import { useState } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { useAuthHeaders } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, UserCog, Building2, Truck } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const CITIES = [
  "Красноярск","Ачинск","Канск","Минусинск","Железногорск","Зеленогорск",
  "Сосновоборск","Дивногорск","Шарыпово","Назарово","Лесосибирск","Енисейск",
  "Бородино","Заозёрный","Уяр","Иланский","Кодинск","Козулька","Норильск",
  "Игарка","Ужур","Абакан","Балахта","Боготол","Большая Мурта","Березовка",
  "Емельяново","Сухобузимо","Тюхтет",
];

export default function CityAdmins() {
  const auth = useAuthHeaders();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [tab, setTab] = useState<"city_admin" | "delivery_admin">("city_admin");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", password: "", role: "city_admin", managedCity: "", partnerCompany: "" });

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["/api/admin/accounts"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/admin/accounts`, { headers: auth.headers });
      if (!r.ok) throw new Error("Ошибка загрузки");
      return r.json();
    },
  });

  const createMut = useMutation({
    mutationFn: async (data: typeof form) => {
      const r = await fetch(`${BASE}/api/admin/accounts`, {
        method: "POST", headers: { ...auth.headers, "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || "Ошибка"); }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/accounts"] });
      setShowForm(false);
      setForm({ name: "", phone: "", password: "", role: tab, managedCity: "", partnerCompany: "" });
      toast({ title: "Аккаунт создан" });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`${BASE}/api/admin/accounts/${id}`, { method: "DELETE", headers: auth.headers });
      if (!r.ok) throw new Error("Ошибка удаления");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/accounts"] }); toast({ title: "Аккаунт удалён" }); },
    onError: () => toast({ title: "Ошибка удаления", variant: "destructive" }),
  });

  const filtered = (accounts as any[]).filter((a: any) => a.role === tab);

  return (
    <MainLayout allowedRoles={["admin"]}>
      <div className="max-w-3xl space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Управление администраторами</h1>
            <p className="text-sm text-white/40 mt-0.5">Городские и партнёрские аккаунты</p>
          </div>
          <button onClick={() => { setForm(f => ({ ...f, role: tab })); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> Создать аккаунт
          </button>
        </div>

        <div className="flex gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1 w-fit">
          {([{ key: "city_admin", label: "Городские адм.", icon: UserCog }, { key: "delivery_admin", label: "Партнёры доставки", icon: Truck }] as const).map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); setShowForm(false); setForm(f => ({ ...f, role: t.key })); }}
              className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                tab === t.key ? "bg-violet-600 text-white" : "text-white/40 hover:text-white/70")}>
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        {showForm && (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">
              {tab === "city_admin" ? "Новый городской администратор" : "Новый партнёр доставки"}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/40 mb-1 block">ФИО</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-violet-500"
                  placeholder="Иванов Иван Иванович" />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">Телефон</label>
                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-violet-500"
                  placeholder="+79001234567" />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">Пароль</label>
                <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-violet-500"
                  placeholder="Минимум 6 символов" />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">Город</label>
                <select value={form.managedCity} onChange={e => setForm(f => ({ ...f, managedCity: e.target.value }))}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500">
                  <option value="">Выберите город</option>
                  {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {tab === "delivery_admin" && (
                <div className="col-span-2">
                  <label className="text-xs text-white/40 mb-1 block">Партнёрская компания (необязательно)</label>
                  <input value={form.partnerCompany} onChange={e => setForm(f => ({ ...f, partnerCompany: e.target.value }))}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-violet-500"
                    placeholder="Название компании-партнёра" />
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={() => createMut.mutate({ ...form, role: tab })}
                disabled={createMut.isPending}
                className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors disabled:opacity-50">
                {createMut.isPending ? "Создание..." : "Создать"}
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl bg-white/[0.05] text-white/60 text-sm hover:text-white transition-colors">
                Отмена
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="text-white/30 text-sm text-center py-8">Загрузка...</div>
        ) : filtered.length === 0 ? (
          <div className="text-white/30 text-sm text-center py-8">
            {tab === "city_admin" ? "Нет городских администраторов" : "Нет партнёров доставки"}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((a: any) => (
              <div key={a.id} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">{a.name}</span>
                    {a.isBlocked && <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">Заблокирован</span>}
                  </div>
                  <div className="text-xs text-white/40 space-x-3">
                    <span>{a.phone}</span>
                    {a.managedCity && <span className="text-violet-400">📍 {a.managedCity}</span>}
                    {a.partnerCompany && <span className="text-emerald-400">🏢 {a.partnerCompany}</span>}
                  </div>
                </div>
                <button onClick={() => { if (confirm("Удалить аккаунт?")) deleteMut.mutate(a.id); }}
                  className="p-2 rounded-xl text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
