import { MainLayout } from "@/components/layout/main-layout";
import { useAuthHeaders } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { formatMoney } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Wallet, CheckCircle, XCircle, Clock, CreditCard } from "lucide-react";
import { useState } from "react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

function useBonusRequestsQuery() {
  const { headers } = useAuthHeaders();
  return useQuery({
    queryKey: ["/api/admin/bonus-requests"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/admin/bonus-requests`, { headers });
      if (!r.ok) throw new Error("Ошибка");
      return r.json();
    },
    refetchInterval: 15000,
  });
}

function usePayBonusRequestMutation() {
  const { headers } = useAuthHeaders();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`${BASE}/api/admin/bonus-requests/${id}/pay`, {
        method: "POST",
        headers,
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || "Ошибка"); }
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/admin/bonus-requests"] }),
  });
}

function useRejectBonusRequestMutation() {
  const { headers } = useAuthHeaders();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`${BASE}/api/admin/bonus-requests/${id}/reject`, {
        method: "POST",
        headers,
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || "Ошибка"); }
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/admin/bonus-requests"] }),
  });
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  pending: { label: "Ожидает", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", icon: Clock },
  paid:    { label: "Выплачено", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", icon: CheckCircle },
  rejected:{ label: "Отклонено", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", icon: XCircle },
};

export default function AdminBonusRequests() {
  const { toast } = useToast();
  const { data: requests, isLoading } = useBonusRequestsQuery();
  const payRequest = usePayBonusRequestMutation();
  const rejectRequest = useRejectBonusRequestMutation();
  const [filter, setFilter] = useState<"all" | "pending" | "paid" | "rejected">("pending");

  const handlePay = async (id: number) => {
    try {
      await payRequest.mutateAsync(id);
      toast({ title: "Выплата отмечена" });
    } catch (e: any) {
      toast({ title: e.message || "Ошибка", variant: "destructive" });
    }
  };

  const handleReject = async (id: number) => {
    try {
      await rejectRequest.mutateAsync(id);
      toast({ title: "Заявка отклонена" });
    } catch (e: any) {
      toast({ title: e.message || "Ошибка", variant: "destructive" });
    }
  };

  const allRequests = Array.isArray(requests) ? requests : [];
  const filtered = filter === "all" ? allRequests : allRequests.filter((r: any) => r.status === filter);
  const pending = allRequests.filter((r: any) => r.status === "pending").length;

  return (
    <MainLayout allowedRoles={["admin"]}>
      <div className="space-y-5 max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Wallet className="w-5 h-5 text-violet-400" /> Запросы на вывод бонусов
            </h1>
            <p className="text-sm text-white/40 mt-0.5">Управление выплатами водителей</p>
          </div>
          {pending > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-sm font-medium text-amber-400">{pending} ожидают</span>
            </div>
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          {(["pending", "paid", "rejected", "all"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-medium transition-all",
                filter === f
                  ? "bg-violet-600 text-white"
                  : "bg-white/[0.04] text-white/50 hover:text-white/70 hover:bg-white/[0.07]"
              )}
            >
              {f === "pending" ? "Ожидают" : f === "paid" ? "Выплачено" : f === "rejected" ? "Отклонённые" : "Все"}
              {f === "pending" && pending > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 bg-amber-500 text-white text-xs rounded-full">{pending}</span>
              )}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-[#0d0d1f] border border-white/[0.08] rounded-2xl p-10 text-center">
            <Wallet className="w-10 h-10 text-white/10 mx-auto mb-3" />
            <p className="text-white/30 text-sm">Запросов нет</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((req: any) => {
              const cfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
              const Icon = cfg.icon;
              return (
                <div key={req.id} className="bg-[#0d0d1f] border border-white/[0.08] rounded-2xl p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="text-sm font-semibold text-white">{req.driverName || "Водитель"}</div>
                      <div className="text-xs text-white/40 mt-0.5">{req.driverPhone || ""}</div>
                      {req.driverCity && (
                        <div className="text-xs text-white/30 mt-0.5">{req.driverCity}</div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-base font-bold text-violet-400">{formatMoney(req.amount)} ₽</div>
                      <div className={cn("text-xs mt-0.5 flex items-center gap-1 justify-end", cfg.color)}>
                        <Icon className="w-3 h-3" /> {cfg.label}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 bg-white/[0.03] rounded-xl px-3 py-2 mb-3">
                    <CreditCard className="w-3.5 h-3.5 text-white/30 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-white/70 font-mono truncate">{req.cardOrPhone || "—"}</div>
                      <div className="text-xs text-white/30">{req.bank || "—"}</div>
                    </div>
                  </div>

                  <div className="text-xs text-white/30 mb-3">
                    {new Date(req.createdAt).toLocaleString("ru-RU")}
                    {req.paidAt && <span className="ml-2 text-emerald-400">Выплачено: {new Date(req.paidAt).toLocaleString("ru-RU")}</span>}
                  </div>

                  {req.status === "pending" && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleReject(req.id)}
                        disabled={rejectRequest.isPending || payRequest.isPending}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium transition-all disabled:opacity-50"
                      >
                        <XCircle className="w-4 h-4" /> Отклонить
                      </button>
                      <button
                        onClick={() => handlePay(req.id)}
                        disabled={payRequest.isPending || rejectRequest.isPending}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-sm font-medium transition-all disabled:opacity-50"
                      >
                        <CheckCircle className="w-4 h-4" /> Оплачено
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
