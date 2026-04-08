import { MainLayout } from "@/components/layout/main-layout";
import { useOrdersQuery } from "@/hooks/use-orders";
import { useAuth } from "@/hooks/use-auth";
import { formatMoney, formatDate } from "@/lib/utils";
import { History as HistoryIcon, MapPin, CheckCircle2, XCircle } from "lucide-react";

export default function PassengerHistory() {
  const { user } = useAuth();
  const { data: orders, isLoading } = useOrdersQuery({ passengerId: user?.id });

  const historyOrders = orders?.filter(o => ['completed', 'cancelled'].includes(o.status)).reverse();

  return (
    <MainLayout allowedRoles={['passenger']}>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-display font-bold mb-8 flex items-center gap-3">
          <HistoryIcon className="text-primary" />
          История поездок
        </h1>

        {isLoading ? (
          <div className="animate-pulse space-y-4">
            {[1,2,3].map(i => <div key={i} className="h-32 bg-card rounded-2xl"></div>)}
          </div>
        ) : historyOrders?.length === 0 ? (
          <div className="text-center py-20 bg-card rounded-3xl border border-white/5">
            <HistoryIcon className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-semibold mb-2">У вас еще не было поездок</h3>
            <p className="text-muted-foreground">Закажите такси на главном экране</p>
          </div>
        ) : (
          <div className="space-y-4">
            {historyOrders?.map(order => (
              <div key={order.id} className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row gap-6 justify-between items-start md:items-center hover-elevate transition-colors hover:bg-card">
                <div className="flex-1 w-full">
                  <div className="flex items-center gap-3 mb-4">
                    {order.status === 'completed' ? (
                      <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-full">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Выполнено
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs font-medium text-destructive bg-destructive/10 px-2.5 py-1 rounded-full">
                        <XCircle className="w-3.5 h-3.5" /> Отменено
                      </span>
                    )}
                    <span className="text-sm text-muted-foreground">{formatDate(order.createdAt ?? undefined)}</span>
                    <span className="text-sm text-muted-foreground px-2 border-l border-white/10">{order.tariffName}</span>
                  </div>

                  <div className="space-y-3 relative pl-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[2px] before:bg-white/10">
                    <div className="relative">
                      <div className="absolute -left-[1.6rem] top-1.5 w-3 h-3 rounded-full bg-primary"></div>
                      <p className="font-medium text-sm">{order.fromAddress}</p>
                    </div>
                    <div className="relative">
                      <div className="absolute -left-[1.6rem] top-1.5 w-3 h-3 rounded-full bg-accent"></div>
                      <p className="font-medium text-sm">{order.toAddress}</p>
                    </div>
                  </div>
                </div>

                <div className="text-left md:text-right shrink-0 bg-black/20 p-4 rounded-xl md:bg-transparent md:p-0">
                  <div className="text-2xl font-bold mb-1">{formatMoney(order.price || 0)}</div>
                  {order.driverName && (
                    <div className="text-sm text-muted-foreground">{order.driverCar} • {order.driverName}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
