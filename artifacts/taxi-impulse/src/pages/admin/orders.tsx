import { MainLayout } from "@/components/layout/main-layout";
import { useOrdersQuery } from "@/hooks/use-orders";
import { formatMoney, formatDate, cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export default function AdminOrders() {
  const { data: orders, isLoading } = useOrdersQuery();

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'pending': return <span className="px-2 py-1 bg-amber-500/20 text-amber-500 rounded text-xs">Поиск</span>;
      case 'accepted': return <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">Принят</span>;
      case 'in_progress': return <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-xs">В пути</span>;
      case 'completed': return <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs">Выполнен</span>;
      case 'cancelled': return <span className="px-2 py-1 bg-destructive/20 text-destructive rounded text-xs">Отменен</span>;
      default: return null;
    }
  };

  return (
    <MainLayout allowedRoles={['admin']}>
      <div className="space-y-6">
        <h1 className="text-3xl font-display font-bold mb-6">Управление заказами</h1>

        <div className="glass-panel rounded-3xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 text-muted-foreground border-b border-white/10">
                <tr>
                  <th className="px-6 py-4 font-medium">ID / Дата</th>
                  <th className="px-6 py-4 font-medium">Маршрут</th>
                  <th className="px-6 py-4 font-medium">Клиент / Водитель</th>
                  <th className="px-6 py-4 font-medium">Статус</th>
                  <th className="px-6 py-4 font-medium text-right">Сумма</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {isLoading ? (
                  <tr><td colSpan={5} className="py-12 text-center"><Loader2 className="animate-spin mx-auto text-primary" /></td></tr>
                ) : orders?.map(order => (
                  <tr key={order.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium">#{order.id}</div>
                      <div className="text-xs text-muted-foreground">{formatDate(order.createdAt ?? undefined)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        {(order as any).orderType === 'delivery' && <span className="text-[10px] bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded-full">📦 Доставка</span>}
                        <div className="max-w-[190px] truncate font-medium text-sm" title={order.fromAddress}>{order.fromAddress}</div>
                      </div>
                      <div className="text-xs text-muted-foreground max-w-[200px] truncate">→ {order.toAddress}</div>
                      {order.comment && <div className="text-xs text-white/30 max-w-[200px] truncate mt-0.5">💬 {order.comment}</div>}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">{order.passengerPhone}</div>
                      <div className="text-xs text-primary">{order.driverPhone || 'Нет водителя'}</div>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(order.status)}
                    </td>
                    <td className="px-6 py-4 text-right font-medium">
                      {formatMoney(order.price || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
