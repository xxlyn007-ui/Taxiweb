import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { useSettingsQuery, useUpdateSettingMutation, useAllSubscriptionsQuery } from "@/hooks/use-subscriptions";
import { useToast } from "@/hooks/use-toast";
import { formatMoney } from "@/lib/utils";
import { Settings, CreditCard, Save, Clock, CheckCircle, XCircle, Users, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  trial:   { label: "Пробный период",  color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/20",   icon: Clock },
  active:  { label: "Активна",         color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", icon: CheckCircle },
  expired: { label: "Истекла",         color: "text-red-400",    bg: "bg-red-500/10 border-red-500/20",    icon: XCircle },
  pending: { label: "Ожидает оплаты",  color: "text-amber-400",  bg: "bg-amber-500/10 border-amber-500/20", icon: RotateCcw },
};

export default function AdminSettings() {
  const { toast } = useToast();
  const { data: settings } = useSettingsQuery();
  const { data: subscriptions } = useAllSubscriptionsQuery();
  const updateSetting = useUpdateSettingMutation();

  const [price, setPrice] = useState("");
  const [trialDays, setTrialDays] = useState("");

  useEffect(() => {
    if (settings) {
      setPrice(settings.subscription_price || "2000");
      setTrialDays(settings.subscription_trial_days || "30");
    }
  }, [settings]);

  const handleSave = async () => {
    try {
      await Promise.all([
        updateSetting.mutateAsync({ key: "subscription_price", value: price }),
        updateSetting.mutateAsync({ key: "subscription_trial_days", value: trialDays }),
      ]);
      toast({ title: "Настройки сохранены" });
    } catch {
      toast({ title: "Ошибка сохранения", variant: "destructive" });
    }
  };

  const uniqueSubs = Array.isArray(subscriptions)
    ? Object.values(
        subscriptions.reduce((acc: any, sub: any) => {
          if (!acc[sub.driverId] || new Date(sub.createdAt) > new Date(acc[sub.driverId].createdAt)) {
            acc[sub.driverId] = sub;
          }
          return acc;
        }, {})
      )
    : [];

  const active = uniqueSubs.filter((s: any) => s.effectiveStatus === "active").length;
  const trial  = uniqueSubs.filter((s: any) => s.effectiveStatus === "trial").length;
  const expired = uniqueSubs.filter((s: any) => s.effectiveStatus === "expired").length;

  return (
    <MainLayout allowedRoles={["admin"]}>
      <div className="space-y-5 max-w-3xl">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-violet-400" /> Настройки системы
          </h1>
          <p className="text-sm text-white/40 mt-0.5">Управление подписками и параметрами платформы</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4">
            <div className="text-xs text-emerald-400/70 uppercase tracking-wider mb-1">Активных</div>
            <div className="text-2xl font-bold text-emerald-400">{active}</div>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4">
            <div className="text-xs text-blue-400/70 uppercase tracking-wider mb-1">Пробных</div>
            <div className="text-2xl font-bold text-blue-400">{trial}</div>
          </div>
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4">
            <div className="text-xs text-red-400/70 uppercase tracking-wider mb-1">Истекших</div>
            <div className="text-2xl font-bold text-red-400">{expired}</div>
          </div>
        </div>

        <div className="bg-[#0d0d1f] border border-white/[0.08] rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <CreditCard className="w-4 h-4 text-violet-400" />
            <h2 className="text-base font-semibold text-white">Параметры подписки</h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-white/40 uppercase tracking-wider mb-2">
                Стоимость в месяц (₽)
              </label>
              <input
                type="number"
                value={price}
                onChange={e => setPrice(e.target.value)}
                min="0"
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40 transition-all"
              />
              <p className="text-xs text-white/30 mt-1.5">
                Текущее: {formatMoney(parseFloat(settings?.subscription_price || "2000"))} / мес
              </p>
            </div>
            <div>
              <label className="block text-xs text-white/40 uppercase tracking-wider mb-2">
                Пробный период (дней)
              </label>
              <input
                type="number"
                value={trialDays}
                onChange={e => setTrialDays(e.target.value)}
                min="0"
                max="365"
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40 transition-all"
              />
              <p className="text-xs text-white/30 mt-1.5">Для новых водителей — бесплатно</p>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={updateSetting.isPending}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-semibold transition-all"
          >
            <Save className="w-4 h-4" />
            {updateSetting.isPending ? "Сохранение..." : "Сохранить настройки"}
          </button>
        </div>

        <div className="bg-[#0d0d1f] border border-white/[0.08] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-2">
            <Users className="w-4 h-4 text-violet-400" />
            <h2 className="text-sm font-semibold text-white">Подписки водителей</h2>
            <span className="ml-auto text-xs text-white/30">{uniqueSubs.length} водителей</span>
          </div>

          {uniqueSubs.length === 0 ? (
            <div className="px-5 py-10 text-center text-white/30 text-sm">Подписок пока нет</div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {(uniqueSubs as any[]).map((sub) => {
                const info = STATUS_LABEL[sub.effectiveStatus] || STATUS_LABEL.expired;
                const Icon = info.icon;
                return (
                  <div key={sub.id} className="px-5 py-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white truncate">{sub.driverName}</span>
                        <span className={cn("px-2 py-0.5 rounded-lg text-xs font-medium border flex items-center gap-1", info.bg, info.color)}>
                          <Icon className="w-3 h-3" />{info.label}
                        </span>
                      </div>
                      <div className="text-xs text-white/40 mt-0.5">{sub.driverPhone}</div>
                    </div>
                    <div className="text-right shrink-0">
                      {sub.effectiveStatus === "trial" ? (
                        <div className="text-sm text-blue-400 font-medium">Осталось {sub.daysLeft} дн.</div>
                      ) : sub.effectiveStatus === "active" ? (
                        <div className="text-sm text-emerald-400 font-medium">до {new Date(sub.endDate).toLocaleDateString("ru-RU")}</div>
                      ) : sub.effectiveStatus === "expired" ? (
                        <div className="text-sm text-red-400 font-medium">Истекла</div>
                      ) : (
                        <div className="text-sm text-amber-400 font-medium">Ожидает</div>
                      )}
                      {sub.amount > 0 && (
                        <div className="text-xs text-white/30 mt-0.5">{formatMoney(sub.amount)}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
