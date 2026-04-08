import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useChangePhoneMutation, useDeleteSelfMutation } from "@/hooks/use-users";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { X, Phone, Trash2, AlertTriangle, User, ChevronRight } from "lucide-react";

interface PassengerProfileModalProps {
  open: boolean;
  onClose: () => void;
}

export function PassengerProfileModal({ open, onClose }: PassengerProfileModalProps) {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const changePhone = useChangePhoneMutation();
  const deleteSelf = useDeleteSelfMutation();

  const [view, setView] = useState<"main" | "phone" | "delete">("main");
  const [newPhone, setNewPhone] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");

  if (!open || !user) return null;

  const handleChangePhone = async () => {
    const phone = newPhone.trim();
    if (!phone || phone.length < 10) {
      toast({ title: "Введите корректный номер телефона", variant: "destructive" });
      return;
    }
    try {
      await changePhone.mutateAsync({ id: user.id, phone });
      try {
        const stored = JSON.parse(localStorage.getItem("taxi_user") || "{}");
        stored.phone = phone;
        localStorage.setItem("taxi_user", JSON.stringify(stored));
      } catch {}
      toast({ title: "Номер телефона изменён", description: "При следующем входе используйте новый номер." });
      setNewPhone("");
      setView("main");
    } catch (e: any) {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (deleteConfirm !== "УДАЛИТЬ") {
      toast({ title: "Введите УДАЛИТЬ для подтверждения", variant: "destructive" });
      return;
    }
    try {
      await deleteSelf.mutateAsync(user.id);
      toast({ title: "Аккаунт удалён" });
      logout();
    } catch (e: any) {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 px-0 sm:px-4">
      <div className="bg-[#1a1025] border border-white/[0.08] rounded-t-3xl sm:rounded-3xl w-full sm:max-w-sm shadow-2xl pb-safe">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/[0.06]">
          <button
            onClick={() => view !== "main" ? setView("main") : onClose()}
            className="text-white/50 hover:text-white transition-colors"
          >
            {view !== "main" ? (
              <span className="text-sm">← Назад</span>
            ) : (
              <X className="w-5 h-5" />
            )}
          </button>
          <span className="text-white font-semibold text-sm">
            {view === "main" ? "Мой профиль" : view === "phone" ? "Изменить телефон" : "Удалить аккаунт"}
          </span>
          <div className="w-8" />
        </div>

        {view === "main" && (
          <div className="px-5 py-4 space-y-3">
            <div className="rounded-2xl bg-white/[0.04] border border-white/[0.06] p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-white/50">
                <User className="w-4 h-4" />
                <span className="text-white/30">Имя</span>
              </div>
              <div className="text-white font-medium">{user.name}</div>
            </div>
            <div className="rounded-2xl bg-white/[0.04] border border-white/[0.06] p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-white/50">
                <Phone className="w-4 h-4" />
                <span className="text-white/30">Телефон</span>
              </div>
              <div className="text-white font-medium">{user.phone}</div>
            </div>

            <button
              onClick={() => { setNewPhone(""); setView("phone"); }}
              className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.06] hover:border-violet-500/30 transition-all"
            >
              <div className="flex items-center gap-3 text-sm text-white/70">
                <Phone className="w-4 h-4 text-violet-400" />
                Изменить номер телефона
              </div>
              <ChevronRight className="w-4 h-4 text-white/20" />
            </button>

            <button
              onClick={() => { setDeleteConfirm(""); setView("delete"); }}
              className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl bg-red-900/10 border border-red-800/20 hover:border-red-700/30 transition-all"
            >
              <div className="flex items-center gap-3 text-sm text-red-400">
                <Trash2 className="w-4 h-4" />
                Удалить аккаунт
              </div>
              <ChevronRight className="w-4 h-4 text-red-400/30" />
            </button>
          </div>
        )}

        {view === "phone" && (
          <div className="px-5 py-4 space-y-4">
            <p className="text-sm text-white/40">
              Введите новый номер телефона. После изменения для входа потребуется новый номер.
            </p>
            <input
              type="tel"
              value={newPhone}
              onChange={e => setNewPhone(e.target.value)}
              placeholder="+7 (999) 999-99-99"
              className="w-full px-4 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.06] text-white text-sm placeholder-white/25 focus:outline-none focus:border-violet-500/50 transition-colors"
            />
            <button
              onClick={handleChangePhone}
              disabled={changePhone.isPending || !newPhone.trim()}
              className="w-full py-3.5 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-all disabled:opacity-50"
            >
              {changePhone.isPending ? "Сохранение…" : "Сохранить"}
            </button>
          </div>
        )}

        {view === "delete" && (
          <div className="px-5 py-4 space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-900/10 border border-red-800/20">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="text-sm text-red-300/80 space-y-1">
                <p className="font-semibold text-red-400">Внимание!</p>
                <p>Все ваши данные и история заказов будут удалены. Это действие нельзя отменить.</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-white/40 mb-2">Введите <span className="text-red-400 font-mono font-semibold">УДАЛИТЬ</span> для подтверждения</p>
              <input
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                placeholder="УДАЛИТЬ"
                className="w-full px-4 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.06] text-white text-sm placeholder-white/20 focus:outline-none focus:border-red-500/50 transition-colors font-mono"
              />
            </div>
            <button
              onClick={handleDelete}
              disabled={deleteSelf.isPending || deleteConfirm !== "УДАЛИТЬ"}
              className="w-full py-3.5 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deleteSelf.isPending ? "Удаление…" : "Удалить аккаунт"}
            </button>
          </div>
        )}

        <div className="h-4" />
      </div>
    </div>
  );
}
