import { useState } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { useDriversQuery, useBlockDriverMutation, useApproveDriverMutation, useUpdateDriverMutation } from "@/hooks/use-drivers";
import { useTariffsQuery } from "@/hooks/use-admin";
import { formatMoney } from "@/lib/utils";
import { Check, X, Ban, Unlock, ChevronDown, ChevronUp, Car, Star, MapPin, Phone, Hash, Shield, Clock, Tag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Tab = "pending" | "active" | "blocked";

export default function AdminDrivers() {
  const { data: drivers, isLoading } = useDriversQuery();
  const { data: tariffs } = useTariffsQuery();
  const blockDriver = useBlockDriverMutation();
  const approveDriver = useApproveDriverMutation();
  const updateDriver = useUpdateDriverMutation();
  const { toast } = useToast();

  const [tab, setTab] = useState<Tab>("pending");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [savingTariffs, setSavingTariffs] = useState<number | null>(null);

  const activeTariffs = Array.isArray(tariffs) ? tariffs.filter(t => t.isActive) : [];

  const pending = drivers?.filter(d => !d.isApproved && !d.isBlocked && !d.rejectionReason) || [];
  const active = drivers?.filter(d => d.isApproved && !d.isBlocked) || [];
  const blocked = drivers?.filter(d => d.isBlocked || (!d.isApproved && d.rejectionReason)) || [];

  const tabDrivers = tab === "pending" ? pending : tab === "active" ? active : blocked;

  const handleApprove = async (id: number) => {
    try {
      await approveDriver.mutateAsync({ id, data: { isApproved: true } });
      toast({ title: "Водитель одобрен" });
    } catch { toast({ title: "Ошибка", variant: "destructive" }); }
  };

  const handleReject = async (id: number) => {
    const reason = rejectReason.trim();
    if (!reason) { toast({ title: "Укажите причину отказа", variant: "destructive" }); return; }
    try {
      await approveDriver.mutateAsync({ id, data: { isApproved: false, rejectionReason: reason } });
      setRejectingId(null);
      setRejectReason("");
      toast({ title: "Водитель отклонён" });
    } catch { toast({ title: "Ошибка", variant: "destructive" }); }
  };

  const handleBlock = async (id: number, isBlocked: boolean) => {
    const label = isBlocked ? "заблокировать" : "разблокировать";
    if (!confirm(`Вы уверены что хотите ${label} водителя?`)) return;
    try {
      await blockDriver.mutateAsync({ id, data: { isBlocked } });
      toast({ title: isBlocked ? "Водитель заблокирован" : "Водитель разблокирован" });
    } catch { toast({ title: "Ошибка", variant: "destructive" }); }
  };

  const handleTariffToggle = async (driverId: number, tariffId: number, currentApproved: number[]) => {
    const next = currentApproved.includes(tariffId)
      ? currentApproved.filter(id => id !== tariffId)
      : [...currentApproved, tariffId];
    setSavingTariffs(driverId);
    try {
      await updateDriver.mutateAsync({ id: driverId, data: { approvedTariffIds: next } as any });
      toast({ title: "Тарифы обновлены" });
    } catch { toast({ title: "Ошибка", variant: "destructive" }); }
    finally { setSavingTariffs(null); }
  };

  return (
    <MainLayout allowedRoles={['admin']}>
      <div className="max-w-4xl space-y-5">
        <div>
          <h1 className="text-xl font-bold text-white">База водителей</h1>
          <p className="text-sm text-white/40 mt-0.5">Проверка заявок и управление водителями</p>
        </div>

        <div className="flex gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1 w-fit">
          {([
            { key: "pending", label: "На проверке", count: pending.length },
            { key: "active", label: "Активные", count: active.length },
            { key: "blocked", label: "Заблокированные", count: blocked.length },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
                tab === t.key ? "bg-violet-600 text-white" : "text-white/40 hover:text-white/70"
              )}
            >
              {t.label}
              {t.count > 0 && (
                <span className={cn("text-xs px-1.5 py-0.5 rounded-full", tab === t.key ? "bg-white/20" : "bg-white/10")}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-24 bg-white/[0.03] rounded-2xl animate-pulse" />)}
          </div>
        ) : tabDrivers.length === 0 ? (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-10 text-center">
            <p className="text-white/40 text-sm">
              {tab === "pending" ? "Новых заявок нет" : tab === "active" ? "Нет активных водителей" : "Нет заблокированных"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {tabDrivers.map(driver => {
              const approvedIds: number[] = (driver as any).approvedTariffIds || [];
              return (
                <div key={driver.id} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
                  <div className="flex items-center gap-4 p-4">
                    <div className="w-10 h-10 rounded-xl bg-violet-600/20 flex items-center justify-center flex-shrink-0">
                      <Car className="w-5 h-5 text-violet-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-white">{driver.name}</span>
                        {driver.isBlocked && <span className="text-xs bg-red-500/15 text-red-400 px-2 py-0.5 rounded-md">Заблокирован</span>}
                        {driver.isApproved && !driver.isBlocked && (
                          <span className={cn("text-xs px-2 py-0.5 rounded-md", driver.status === 'online' ? "bg-emerald-500/15 text-emerald-400" : driver.status === 'busy' ? "bg-amber-500/15 text-amber-400" : "bg-white/5 text-white/30")}>
                            {driver.status === 'online' ? 'На линии' : driver.status === 'busy' ? 'В поездке' : 'Оффлайн'}
                          </span>
                        )}
                        {driver.rejectionReason && !driver.isApproved && !driver.isBlocked && (
                          <span className="text-xs bg-orange-500/15 text-orange-400 px-2 py-0.5 rounded-md">Отклонён</span>
                        )}
                        {approvedIds.length > 0 && (
                          <span className="text-xs bg-violet-500/15 text-violet-400 px-2 py-0.5 rounded-md">
                            {approvedIds.length} тариф{approvedIds.length === 1 ? '' : 'а'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-white/40 mt-0.5">
                        <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{driver.phone}</span>
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{driver.workCity || driver.city}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setExpandedId(expandedId === driver.id ? null : driver.id)}
                      className="p-2 text-white/30 hover:text-white/60 transition-colors"
                    >
                      {expandedId === driver.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>

                  {expandedId === driver.id && (
                    <div className="border-t border-white/[0.06] p-4 space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <DetailItem icon={Car} label="Автомобиль" value={`${driver.carModel} ${driver.carColor ? `(${driver.carColor})` : ''}`} />
                        <DetailItem icon={Hash} label="Гос. номер" value={driver.carNumber} />
                        {driver.licenseNumber && <DetailItem icon={Shield} label="Удостоверение" value={driver.licenseNumber} />}
                        {driver.experience != null && <DetailItem icon={Clock} label="Стаж" value={`${driver.experience} лет`} />}
                        <DetailItem icon={Star} label="Рейтинг" value={`★ ${driver.rating?.toFixed(1) || '5.0'}`} />
                        <DetailItem icon={Car} label="Поездок" value={driver.totalRides?.toString() || '0'} />
                      </div>

                      {driver.rejectionReason && (
                        <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3">
                          <div className="text-xs text-orange-400 font-medium mb-1">Причина отказа</div>
                          <div className="text-sm text-white/60">{driver.rejectionReason}</div>
                        </div>
                      )}

                      {activeTariffs.length > 0 && (
                        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3">
                          <div className="flex items-center gap-2 mb-3">
                            <Tag className="w-3.5 h-3.5 text-violet-400" />
                            <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">Разрешённые классы авто</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {activeTariffs.map(tariff => {
                              const isOn = approvedIds.includes(tariff.id);
                              return (
                                <button
                                  key={tariff.id}
                                  onClick={() => handleTariffToggle(driver.id, tariff.id, approvedIds)}
                                  disabled={savingTariffs === driver.id}
                                  className={cn(
                                    "flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-left transition-all border",
                                    isOn
                                      ? "bg-violet-600/20 border-violet-600/40 text-violet-300"
                                      : "bg-white/[0.03] border-white/[0.06] text-white/40 hover:border-white/15"
                                  )}
                                >
                                  <div className={cn("w-4 h-4 rounded-md border flex items-center justify-center flex-shrink-0 transition-all",
                                    isOn ? "bg-violet-600 border-violet-600" : "border-white/20"
                                  )}>
                                    {isOn && <Check className="w-2.5 h-2.5 text-white" />}
                                  </div>
                                  <span className="font-medium">{tariff.name}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 pt-1">
                        {tab === "pending" && (
                          <>
                            <button
                              onClick={() => handleApprove(driver.id)}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 text-sm font-medium transition-all"
                            >
                              <Check className="w-4 h-4" /> Одобрить
                            </button>
                            {rejectingId === driver.id ? (
                              <div className="flex-1 flex gap-2 min-w-0">
                                <input
                                  value={rejectReason}
                                  onChange={e => setRejectReason(e.target.value)}
                                  placeholder="Причина отказа..."
                                  className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-red-500/50"
                                />
                                <button onClick={() => handleReject(driver.id)} className="px-3 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-400 text-sm transition-all">Отправить</button>
                                <button onClick={() => { setRejectingId(null); setRejectReason(""); }} className="px-3 py-2 rounded-xl bg-white/5 text-white/40 text-sm transition-all"><X className="w-4 h-4" /></button>
                              </div>
                            ) : (
                              <button onClick={() => setRejectingId(driver.id)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium transition-all">
                                <X className="w-4 h-4" /> Отклонить
                              </button>
                            )}
                          </>
                        )}
                        {tab === "active" && (
                          <button onClick={() => handleBlock(driver.id, true)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium transition-all">
                            <Ban className="w-4 h-4" /> Заблокировать
                          </button>
                        )}
                        {tab === "blocked" && (
                          <>
                            <button onClick={() => handleBlock(driver.id, false)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-sm font-medium transition-all">
                              <Unlock className="w-4 h-4" /> Разблокировать
                            </button>
                            {!driver.isApproved && (
                              <button onClick={() => handleApprove(driver.id)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600/15 hover:bg-violet-600/25 text-violet-400 text-sm font-medium transition-all">
                                <Check className="w-4 h-4" /> Одобрить заявку
                              </button>
                            )}
                          </>
                        )}
                      </div>
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

function DetailItem({ icon: Icon, label, value }: { icon: any; label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-3.5 h-3.5 text-white/30 mt-0.5 flex-shrink-0" />
      <div>
        <div className="text-xs text-white/30">{label}</div>
        <div className="text-sm text-white/80">{value}</div>
      </div>
    </div>
  );
}
