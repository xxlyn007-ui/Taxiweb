import { useState } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { useAuthHeaders } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Wallet, Send, Clock, CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
function formatMoney(v: number) { return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(v); }
function formatDate(d: any) { return d ? new Date(d).toLocaleString("ru-RU") : "—"; }

export default function DriverDeliveryPayout() {
  const auth = useAuthHeaders();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [paymentDetails, setPaymentDetails] = useState("");

  // Данные водителя
  const { data: driverData } = useQuery({
    queryKey: ["/api/drivers/me"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/drivers`, { headers: auth.headers });
      if (!r.ok) return null;
      const drivers = await r.json();
      return drivers?.[0] || null;
    },
  });

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["/api/payout-requests"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/payout-requests`, { headers: auth.headers });
      if (!r.ok) return [];
      return r.json();
    },
    refetchInterval: 30000,
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${BASE}/api/payout-requests`, {
        method: "POST", headers: { ...auth.headers, "Content-Type": "application/json" },
        body: JSON.stringify({ paymentDetails }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || "Ошибка"); }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/payout-requests"] });
      setPaymentDetails("");
      toast({ title: "Запрос отправлен администратору" });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const deliveryBalance = driverData?.deliveryBalance || 0;
  const hasPendingRequest = (requests as any[]).some((r: any) => r.status === "pending");

  const STATUS_ICONS: Record<string, any> = {
    pending: <Clock className="w-4 h-4 text-amber-400" />,
    approved: <CheckCircle className="w-4 h-4 text-emerald-400" />,
    rejected: <XCircle className="w-4 h-4 text-red-400" />,
  };
  const STATUS_LABELS: Record<string, string> = { pending: "Ожидает", approved: "Одобрена", rejected: "Отклонена" };

  return (
    <MainLayout allowedRoles={["driver"]}>
      <div className="max-w-xl space-y-5">
        <div>
          <h1 className="text-xl font-bold text-white">Баланс доставки</h1>
          <p className="text-sm text-white/40 mt-0.5">Заработок от выполнения заказов доставки</p>
        </div>

        {/* Баланс */}
        <div className="bg-gradient-to-br from-violet-600/20 to-violet-900/20 border border-violet-500/30 rounded-2xl p-6 text-center">
          <Wallet className="w-8 h-8 text-violet-400 mx-auto mb-2" />
          <div className="text-xs text-white/40 mb-1">Доступный баланс</div>
          <div className="text-4xl font-bold text-white mb-1">{formatMoney(deliveryBalance)}</div>
          <div className="text-xs text-white/30">Заработок от заказов доставки</div>
        </div>

        {/* Форма запроса выплаты */}
        {deliveryBalance > 0 && !hasPendingRequest && (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">Запросить выплату</h3>
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Номер карты или телефона</label>
              <input
                value={paymentDetails}
                onChange={e => setPaymentDetails(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-violet-500"
                placeholder="4276 **** **** 1234 или +7 900 000 00 00"
              />
              <p className="text-xs text-white/30 mt-1">Администратор получит уведомление и выплатит сумму {formatMoney(deliveryBalance)}</p>
            </div>
            <button
              onClick={() => createMut.mutate()}
              disabled={!paymentDetails.trim() || createMut.isPending}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium disabled:opacity-50 transition-colors w-full justify-center">
              <Send className="w-4 h-4" />
              {createMut.isPending ? "Отправка..." : "Запросить выплату"}
            </button>
          </div>
        )}

        {hasPendingRequest && (
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 text-center">
            <Clock className="w-6 h-6 text-amber-400 mx-auto mb-2" />
            <p className="text-sm text-amber-400 font-medium">Запрос на выплату отправлен</p>
            <p className="text-xs text-white/30 mt-1">Ожидайте обработки администратором</p>
          </div>
        )}

        {/* История выплат */}
        {(requests as any[]).length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">История выплат</h3>
            <div className="space-y-2">
              {(requests as any[]).map((r: any) => (
                <div key={r.id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {STATUS_ICONS[r.status]}
                    <div>
                      <div className="text-sm font-medium text-white">{formatMoney(r.amount)}</div>
                      <div className="text-xs text-white/30">{r.paymentDetails} · {formatDate(r.createdAt)}</div>
                    </div>
                  </div>
                  <span className={cn("text-xs font-medium", r.status === "approved" ? "text-emerald-400" : r.status === "rejected" ? "text-red-400" : "text-amber-400")}>
                    {STATUS_LABELS[r.status]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
