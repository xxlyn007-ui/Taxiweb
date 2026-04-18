import { useState } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { useAuth } from "@/hooks/use-auth";
import { useAuthHeaders } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { User, Phone, Trash2, Save, LogOut, Shield, Sun, Moon, ChevronRight } from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

function applyThemeClass(t: string) {
  if (t === "light") {
    document.documentElement.classList.add("theme-light");
  } else {
    document.documentElement.classList.remove("theme-light");
  }
}

function useTheme() {
  const getTheme = () => {
    try {
      const t = localStorage.getItem("taxi_theme") || "dark";
      applyThemeClass(t);
      return t;
    } catch { return "dark"; }
  };
  const [theme, setThemeState] = useState(getTheme);

  const setTheme = (t: string) => {
    setThemeState(t);
    try { localStorage.setItem("taxi_theme", t); } catch {}
    applyThemeClass(t);
  };

  return { theme, setTheme };
}

export default function AccountPage() {
  const { user, logout, updateUser } = useAuth();
  const authHeaders = useAuthHeaders();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { theme, setTheme } = useTheme();

  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");

  const handleSaveProfile = async () => {
    if (!user) return;
    const newName = name.trim();
    const newPhone = phone.trim();
    if (!newName && !newPhone) {
      toast({ title: "Нет изменений" });
      return;
    }
    setSavingProfile(true);
    try {
      const changed: string[] = [];
      const userPatch: Partial<typeof user> = {};

      if (newName && newName !== user.name) {
        const r = await fetch(`${BASE}/api/users/${user.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...authHeaders.headers },
          body: JSON.stringify({ name: newName }),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Ошибка обновления имени");
        changed.push("имя");
        userPatch.name = data.name ?? newName;
      }

      if (newPhone && newPhone !== user.phone) {
        const r = await fetch(`${BASE}/api/users/${user.id}/phone`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...authHeaders.headers },
          body: JSON.stringify({ phone: newPhone }),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Ошибка обновления телефона");
        changed.push("телефон");
        userPatch.phone = data.phone ?? newPhone;
      }

      if (changed.length > 0) {
        updateUser(userPatch);
        toast({ title: `Сохранено: ${changed.join(", ")}` });
      } else {
        toast({ title: "Нет изменений" });
      }
    } catch (e: any) {
      toast({ title: e.message || "Ошибка сохранения", variant: "destructive" });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user || deleteInput !== "УДАЛИТЬ") {
      toast({ title: "Введите УДАЛИТЬ для подтверждения", variant: "destructive" });
      return;
    }
    setDeletingAccount(true);
    try {
      const r = await fetch(`${BASE}/api/users/${user.id}`, {
        method: "DELETE",
        headers: authHeaders.headers,
      });
      if (!r.ok) throw new Error("Ошибка удаления");
      toast({ title: "Аккаунт удалён" });
      logout();
      setLocation("/login");
    } catch (e: any) {
      toast({ title: e.message || "Ошибка", variant: "destructive" });
    } finally {
      setDeletingAccount(false);
    }
  };

  if (!user) return null;

  return (
    <MainLayout allowedRoles={["passenger", "driver"]}>
      <div className="max-w-lg mx-auto space-y-5 pb-8">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-violet-400" /> Настройки аккаунта
          </h1>
          <p className="text-sm text-white/40 mt-0.5">Управление профилем и безопасностью</p>
        </div>

        <div className="bg-[#0d0d1f] border border-white/[0.08] rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-2xl bg-violet-600/30 flex items-center justify-center text-violet-300 text-xl font-bold flex-shrink-0">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-base font-semibold text-white">{user.name}</div>
              <div className="text-sm text-white/40">{user.role === "driver" ? "Водитель" : "Пассажир"}</div>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-white/40 uppercase tracking-wider block mb-1.5">Имя</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pl-9 pr-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-white/40 uppercase tracking-wider block mb-1.5">Телефон</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pl-9 pr-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40 transition-all"
                />
              </div>
            </div>

            <button
              onClick={handleSaveProfile}
              disabled={savingProfile}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-semibold transition-all"
            >
              <Save className="w-4 h-4" />
              {savingProfile ? "Сохранение..." : "Сохранить изменения"}
            </button>
          </div>
        </div>

        <div className="bg-[#0d0d1f] border border-white/[0.08] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06]">
            <h2 className="text-sm font-semibold text-white">Оформление</h2>
          </div>
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="w-full flex items-center gap-3 px-5 py-4 hover:bg-white/[0.03] transition-all"
          >
            <div className="w-9 h-9 rounded-xl bg-violet-600/20 flex items-center justify-center">
              {theme === "dark" ? <Moon className="w-4 h-4 text-violet-400" /> : <Sun className="w-4 h-4 text-amber-400" />}
            </div>
            <div className="text-left flex-1">
              <div className="text-sm font-medium text-white">Тема</div>
              <div className="text-xs text-white/40">{theme === "dark" ? "Тёмная" : "Светлая"}</div>
            </div>
            <div className="w-10 h-6 rounded-full transition-all relative" style={{ background: theme === "light" ? "#7c3aed" : "rgba(255,255,255,0.1)" }}>
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${theme === "light" ? "left-4" : "left-0.5"}`} />
            </div>
          </button>
        </div>

        <div className="bg-[#0d0d1f] border border-white/[0.08] rounded-2xl overflow-hidden">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-5 py-4 hover:bg-white/[0.03] transition-all"
          >
            <div className="w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center">
              <LogOut className="w-4 h-4 text-white/50" />
            </div>
            <div className="text-sm font-medium text-white/70 flex-1 text-left">Выйти из аккаунта</div>
            <ChevronRight className="w-4 h-4 text-white/20" />
          </button>
        </div>

        <div className="bg-[#0d0d1f] border border-red-500/20 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06]">
            <h2 className="text-sm font-semibold text-red-400">Опасная зона</h2>
          </div>

          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full flex items-center gap-3 px-5 py-4 hover:bg-red-500/5 transition-all"
            >
              <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center">
                <Trash2 className="w-4 h-4 text-red-400" />
              </div>
              <div className="text-left flex-1">
                <div className="text-sm font-medium text-red-400">Удалить аккаунт</div>
                <div className="text-xs text-white/30">Все данные будут удалены безвозвратно</div>
              </div>
            </button>
          ) : (
            <div className="p-5 space-y-3">
              <p className="text-sm text-white/60">
                Введите <span className="text-red-400 font-mono font-bold">УДАЛИТЬ</span> для подтверждения удаления аккаунта.
                Это действие <strong className="text-red-400">невозможно отменить</strong>.
              </p>
              <input
                value={deleteInput}
                onChange={e => setDeleteInput(e.target.value)}
                placeholder="Введите УДАЛИТЬ"
                className="w-full bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-red-500/40"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowDeleteConfirm(false); setDeleteInput(""); }}
                  className="flex-1 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/10 text-white/60 text-sm font-medium transition-all"
                >
                  Отмена
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deletingAccount || deleteInput !== "УДАЛИТЬ"}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-400 disabled:opacity-40 text-white text-sm font-semibold transition-all"
                >
                  {deletingAccount ? "Удаление..." : "Удалить"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
