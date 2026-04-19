import { useState } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { useAuth } from "@/hooks/use-auth";
import { useAllUsersQuery, useBlockUserMutation, useDeleteUserMutation } from "@/hooks/use-users";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Search, Ban, Unlock, Trash2, User, Phone, Shield, Car, Clock, AlertTriangle, X
} from "lucide-react";

const ROLE_LABEL: Record<string, string> = {
  passenger: "Пассажир",
  driver: "Водитель",
  admin: "Администратор",
};

const ROLE_COLOR: Record<string, string> = {
  passenger: "text-blue-400",
  driver: "text-green-400",
  admin: "text-violet-400",
};

function formatDate(dt: any) {
  if (!dt) return "—";
  try {
    return new Date(dt).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" });
  } catch { return "—"; }
}

export default function AdminUsers() {
  const { user } = useAuth();
  const managedCity = user?.role === "city_admin" ? (user as any).managedCity : undefined;
  const { data: allUsers, isLoading } = useAllUsersQuery(managedCity);
  const blockUser = useBlockUserMutation();
  const deleteUser = useDeleteUserMutation();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "passenger" | "driver">("all");
  const [blockedFilter, setBlockedFilter] = useState<"all" | "blocked" | "active">("all");
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const users: any[] = allUsers || [];

  const filtered = users.filter(u => {
    const matchSearch = !search || u.phone?.includes(search) || u.name?.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    const matchBlocked = blockedFilter === "all" ||
      (blockedFilter === "blocked" && u.isBlocked) ||
      (blockedFilter === "active" && !u.isBlocked);
    return matchSearch && matchRole && matchBlocked;
  });

  const handleBlock = async (u: any) => {
    const action = u.isBlocked ? "разблокировать" : "заблокировать";
    try {
      await blockUser.mutateAsync({ id: u.id, isBlocked: !u.isBlocked });
      toast({ title: `Пользователь ${action === "разблокировать" ? "разблокирован" : "заблокирован"}` });
    } catch (e: any) {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteUser.mutateAsync(id);
      setConfirmDelete(null);
      toast({ title: "Пользователь удалён" });
    } catch (e: any) {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    }
  };

  const totalPassengers = users.filter(u => u.role === "passenger").length;
  const totalDrivers = users.filter(u => u.role === "driver").length;
  const totalBlocked = users.filter(u => u.isBlocked).length;

  return (
    <MainLayout allowedRoles={["admin", "city_admin"]}>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        <h1 className="text-xl font-bold text-white">Пользователи</h1>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Пассажиров", value: totalPassengers, color: "text-blue-400" },
            { label: "Водителей", value: totalDrivers, color: "text-green-400" },
            { label: "Заблокировано", value: totalBlocked, color: "text-red-400" },
          ].map(s => (
            <div key={s.label} className="rounded-2xl bg-white/[0.04] border border-white/[0.06] p-4 text-center">
              <div className={cn("text-2xl font-bold", s.color)}>{s.value}</div>
              <div className="text-xs text-white/40 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по имени или телефону…"
            className="w-full pl-9 pr-4 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.06] text-white text-sm placeholder-white/25 focus:outline-none focus:border-violet-500/50 transition-colors"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          {(["all", "passenger", "driver"] as const).map(r => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={cn(
                "px-4 py-1.5 rounded-full text-xs font-medium transition-all",
                roleFilter === r
                  ? "bg-violet-600 text-white"
                  : "bg-white/[0.05] text-white/50 hover:text-white/70"
              )}
            >
              {r === "all" ? "Все" : ROLE_LABEL[r]}
            </button>
          ))}
          <div className="ml-auto flex gap-2">
            {(["all", "active", "blocked"] as const).map(b => (
              <button
                key={b}
                onClick={() => setBlockedFilter(b)}
                className={cn(
                  "px-4 py-1.5 rounded-full text-xs font-medium transition-all",
                  blockedFilter === b
                    ? b === "blocked" ? "bg-red-600/80 text-white" : "bg-violet-600 text-white"
                    : "bg-white/[0.05] text-white/50 hover:text-white/70"
                )}
              >
                {b === "all" ? "Все" : b === "active" ? "Активные" : "Заблокированные"}
              </button>
            ))}
          </div>
        </div>

        {isLoading && (
          <div className="text-center py-10 text-white/30 text-sm">Загрузка…</div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-10 text-white/30 text-sm">Нет пользователей</div>
        )}

        <div className="space-y-2">
          {filtered.map(u => (
            <div
              key={u.id}
              className={cn(
                "rounded-2xl border p-4 transition-all",
                u.isBlocked
                  ? "bg-red-900/10 border-red-800/20"
                  : "bg-white/[0.03] border-white/[0.06]"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-medium text-sm truncate">{u.name}</span>
                    <span className={cn("text-xs font-medium", ROLE_COLOR[u.role] || "text-white/40")}>
                      {u.role === "driver" ? <Car className="w-3 h-3 inline mr-0.5" /> : <User className="w-3 h-3 inline mr-0.5" />}
                      {ROLE_LABEL[u.role] || u.role}
                    </span>
                    {u.isBlocked && (
                      <span className="text-xs text-red-400 flex items-center gap-0.5">
                        <Ban className="w-3 h-3" /> заблокирован
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-3 flex-wrap text-xs text-white/40">
                    <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{u.phone}</span>
                    {u.city && <span className="flex items-center gap-1"><Shield className="w-3 h-3" />{u.city}</span>}
                    {u.createdAt && (
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />с {formatDate(u.createdAt)}</span>
                    )}
                    {u.totalRides > 0 && (
                      <span className="text-white/30">{u.totalRides} поездок</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {u.role !== "admin" && (
                    <>
                      <button
                        onClick={() => handleBlock(u)}
                        disabled={blockUser.isPending}
                        title={u.isBlocked ? "Разблокировать" : "Заблокировать"}
                        className={cn(
                          "p-2 rounded-xl border transition-all",
                          u.isBlocked
                            ? "border-green-700/30 text-green-400 hover:bg-green-900/20"
                            : "border-orange-700/30 text-orange-400 hover:bg-orange-900/20"
                        )}
                      >
                        {u.isBlocked ? <Unlock className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(u.id)}
                        title="Удалить аккаунт"
                        className="p-2 rounded-xl border border-red-800/30 text-red-400 hover:bg-red-900/20 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {confirmDelete !== null && (() => {
        const u = users.find(x => x.id === confirmDelete);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
            <div className="bg-[#1a1025] border border-white/10 rounded-3xl p-6 max-w-sm w-full shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <div className="text-white font-semibold">Удалить аккаунт?</div>
                  <div className="text-xs text-white/40 mt-0.5">{u?.name} · {u?.phone}</div>
                </div>
              </div>
              <p className="text-sm text-white/50 mb-5">
                Все заказы будут отменены. Действие необратимо.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="flex-1 py-3 rounded-2xl bg-white/[0.05] text-white/70 text-sm font-medium hover:bg-white/[0.08] transition-all"
                >
                  Отмена
                </button>
                <button
                  onClick={() => handleDelete(confirmDelete)}
                  disabled={deleteUser.isPending}
                  className="flex-1 py-3 rounded-2xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-all disabled:opacity-50"
                >
                  {deleteUser.isPending ? "Удаление…" : "Удалить"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </MainLayout>
  );
}
