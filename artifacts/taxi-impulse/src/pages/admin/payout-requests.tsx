import { MainLayout } from "@/components/layout/main-layout";
import { useAuthHeaders } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
function formatMoney(v: number) { return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(v); }
function formatDate(d: any) { return d ? new Date(d).toLocaleString("ru-RU") : "—"; }

const STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: "Ожидает", color: "text-amber-400 bg-amber-500/10" },
  approved: { label: "Одобрена", color: "text-emerald-400 bg-emerald-500/10" },
  rejected: { label: "Отклонена", color: "text-red-400 bg-red-500/10" },
};

export default function PayoutRequests() {
  const auth = useAuthHeaders();
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["/api/payout-requests"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/payout-requests`, { headers: auth.headers });
      if (!r.ok) throw new Error("Ошибка");
      return r.json();
    },
    refetchInterval: 20000,
  });

  const processMut = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const r = await fetch(`${BASE}/api/payout-requests/${id}`, {
        method: "PATCH", headers: { ...auth.headers, "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!r.ok) throw new Error("Ошибка");
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/payout-requests"] }); toast({ title: "Выплата обработана" }); },
    onError: () => toast({ title: "Ошибка", variant: "destructive" }),
  });

  const pending = (requests as any[]).filter((r: any) => r.status === "pending");
  const processed = (requests as any[]).filter((r: any) => r.status !== "pending");

  return (
    <MainLayout allowedRoles={["admin", "delivery_admin"]}>
      <div className="max-w-3xl space-y-5">
        <div>
          <h1 className="text-xl font-bold text-white">Выплаты водителям</h1>
          <p className="text-sm text-white/40 mt-0.5">Запросы на выплату баланса доставки</p>
        </div>

        {pending.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Ожидают обработки ({pending.length})</h2>
            <div className="space-y-2">
              {pending.map((r: any) => (
                <div key={r.id} className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">{r.driverName}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">Ожидает</span>
                      </div>
                      <div className="text-xs text-white/40 space-x-3">
                        <span>{r.driverPhone}</span>
                        <span>{r.driverCar} · {r.driverCarNumber}</span>
                      </div>
                      <div className="flex items-center gap-4 mt-2">
                        <div className="bg-white/[0.04] rounded-xl px-3 py-1.5">
                          <div className="text-xs text-white/40">Сумма выплаты</div>
                          <div className="text-lg font-bold text-violet-400">{formatMoney(r.amount)}</div>
                        </div>
                        <div className="bg-white/[0.04] rounded-xl px-3 py-1.5">
                          <div className="text-xs text-white/40">Реквизиты</div>
                          <div className="text-sm font-semibold text-white">{r.paymentDetails}</div>
                        </div>
                      </div>
                      <div className="text-xs text-white/30">{formatDate(r.createdAt)}</div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => { if (confirm(`Одобрить выплату ${formatMoney(r.amount)}?`)) processMut.mutate({ id: r.id, status: "approved" }); }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-xs font-medium transition-colors">
                        <CheckCircle className="w-3.5 h-3.5" /> Одобрить
                      </button>
                      <button onClick={() => processMut.mutate({ id: r.id, status: "rejected" })}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-medium transition-colors">
                        <XCircle className="w-3.5 h-3.5" /> Отклонить
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {pending.length === 0 && !isLoading && (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-8 text-center">
            <Clock className="w-8 h-8 text-white/20 mx-auto mb-2" />
            <p className="text-white/30 text-sm">Нет ожидающих запросов на выплату</p>
          </div>
        )}

        {processed.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">История ({processed.length})</h2>
            <div className="space-y-2">
              {processed.map((r: any) => (
                <div key={r.id} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{r.driverName}</span>
                        <span className={cn("text-xs px-2 py-0.5 rounded-full", STATUS[r.status]?.color)}>{STATUS[r.status]?.label}</span>
                      </div>
                      <div className="text-xs text-white/40">{r.driverPhone} · {r.paymentDetails}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-white">{formatMoney(r.amount)}</div>
                      <div className="text-xs text-white/30">{formatDate(r.processedAt || r.createdAt)}</div>
                    </div>
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
