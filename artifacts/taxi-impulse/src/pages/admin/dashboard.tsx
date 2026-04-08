import { MainLayout } from "@/components/layout/main-layout";
import { useStatsQuery, useStatsByCityQuery } from "@/hooks/use-admin";
import { formatMoney } from "@/lib/utils";
import { TrendingUp, Car, Users, MapPin, Activity, DollarSign } from "lucide-react";

export default function AdminDashboard() {
  const { data: stats } = useStatsQuery();
  const { data: cityStats } = useStatsByCityQuery();

  return (
    <MainLayout allowedRoles={['admin']}>
      <div className="space-y-5 max-w-5xl">
        <div>
          <h1 className="text-xl font-bold text-white">Статистика платформы</h1>
          <p className="text-sm text-white/40 mt-0.5">Актуальные данные по всем городам</p>
        </div>

        {/* Top KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="Заказов сегодня" value={stats?.ordersToday?.toString() || '0'} icon={Activity} color="violet" />
          <KpiCard label="Водители онлайн" value={`${stats?.activeDrivers || 0}/${stats?.totalDrivers || 0}`} icon={Car} color="emerald" />
          <KpiCard label="Пассажиров" value={stats?.totalPassengers?.toString() || '0'} icon={Users} color="blue" />
          <KpiCard label="Выручка сегодня" value={formatMoney(stats?.revenueToday || 0)} icon={DollarSign} color="amber" />
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Всего заказов</div>
            <div className="text-xl font-bold text-white">{stats?.totalOrders || 0}</div>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Выполнено</div>
            <div className="text-xl font-bold text-emerald-400">{stats?.completedOrders || 0}</div>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Отменено</div>
            <div className="text-xl font-bold text-red-400">{stats?.cancelledOrders || 0}</div>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Общая выручка</div>
            <div className="text-xl font-bold text-white">{formatMoney(stats?.revenue || 0)}</div>
          </div>
        </div>

        {/* City breakdown */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-2">
            <MapPin className="w-4 h-4 text-violet-400" />
            <h3 className="text-sm font-semibold text-white">По городам Красноярского края</h3>
          </div>

          {!cityStats || cityStats.length === 0 ? (
            <div className="px-5 py-8 text-center text-white/30 text-sm">Данных пока нет</div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              <div className="grid grid-cols-5 px-5 py-2.5 text-xs text-white/30 uppercase tracking-wider">
                <span className="col-span-2">Город</span>
                <span className="text-center">Заказов сегодня</span>
                <span className="text-center">Всего</span>
                <span className="text-center">Водители</span>
              </div>
              {cityStats.map(city => (
                <div key={city.city} className="grid grid-cols-5 px-5 py-3.5 items-center hover:bg-white/[0.02] transition-colors">
                  <div className="col-span-2">
                    <div className="text-sm font-medium text-white">{city.city}</div>
                  </div>
                  <div className="text-center">
                    <span className={`text-sm font-semibold ${city.ordersToday > 0 ? 'text-violet-400' : 'text-white/30'}`}>
                      {city.ordersToday}
                    </span>
                  </div>
                  <div className="text-center">
                    <span className="text-sm text-white/60">{city.totalOrders}</span>
                  </div>
                  <div className="text-center">
                    <span className="text-xs">
                      <span className="text-emerald-400 font-medium">{city.driversOnline}</span>
                      <span className="text-white/30">/{city.totalDrivers}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}

function KpiCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: any; color: string }) {
  const colors: Record<string, string> = {
    violet: "bg-violet-600/20 text-violet-400",
    emerald: "bg-emerald-500/20 text-emerald-400",
    blue: "bg-blue-500/20 text-blue-400",
    amber: "bg-amber-500/20 text-amber-400",
  };
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${colors[color]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="text-xl font-bold text-white">{value}</div>
      <div className="text-xs text-white/40 mt-0.5">{label}</div>
    </div>
  );
}
