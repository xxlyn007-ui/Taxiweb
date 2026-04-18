import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useAuthHeaders } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  Car, LayoutDashboard, MapPin, BadgeRussianRuble, LogOut, FileText, Users,
  Headphones, Clock, Settings, Building2, Bell, Users2, Wallet, UserCog, Server
} from "lucide-react";

interface NavItem { title: string; url: string; icon: React.ElementType; badge?: React.ReactNode; }

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

function useAvailableOrdersCount(driverId?: number) {
  const authHeaders = useAuthHeaders();
  return useQuery({
    queryKey: ["/api/orders/available-count", driverId],
    enabled: !!driverId,
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/orders?status=pending`, { headers: authHeaders.headers });
      if (!r.ok) return 0;
      const data = await r.json();
      return Array.isArray(data) ? data.length : 0;
    },
    refetchInterval: 10000,
  });
}

function useDriverId(userId?: number) {
  const authHeaders = useAuthHeaders();
  return useQuery({
    queryKey: ["/api/drivers/my-id", userId],
    enabled: !!userId,
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/drivers`, { headers: authHeaders.headers });
      if (!r.ok) return null;
      const data = await r.json();
      const me = data.find((d: any) => d.userId === userId);
      return me?.id || null;
    },
    staleTime: 60_000,
  });
}

export function Sidebar() {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  if (!user) return null;

  const { data: driverId } = useDriverId(user.role === "driver" ? user.id : undefined);
  const { data: orderCount = 0 } = useAvailableOrdersCount(user.role === "driver" ? driverId ?? undefined : undefined);

  const hasOrders = (orderCount as number) > 0;

  let items: NavItem[] = [];
  if (user.role === "passenger") {
    items = [
      { title: "Заказать такси", url: "/passenger", icon: Car },
      { title: "Попутки", url: "/passenger/rideshare", icon: Users2 },
      { title: "История", url: "/passenger/history", icon: Clock },
      { title: "Поддержка", url: "/support", icon: Headphones },
      { title: "Аккаунт", url: "/account", icon: UserCog },
    ];
  } else if (user.role === "driver") {
    items = [
      { title: "Мой кабинет", url: "/driver", icon: LayoutDashboard },
      {
        title: "Заказы", url: "/driver/orders", icon: MapPin,
        badge: (
          <div className={cn(
            "ml-auto w-2.5 h-2.5 rounded-full flex-shrink-0 transition-colors",
            hasOrders ? "bg-emerald-500" : "bg-violet-600"
          )} />
        )
      },
      { title: "Попутки", url: "/driver/rideshare", icon: Users2 },
      { title: "Договор-оферта", url: "/driver/contract", icon: FileText },
      { title: "Поддержка", url: "/support", icon: Headphones },
      { title: "Аккаунт", url: "/account", icon: UserCog },
    ];
  } else if (user.role === "admin") {
    items = [
      { title: "Статистика", url: "/admin", icon: LayoutDashboard },
      { title: "Заказы", url: "/admin/orders", icon: FileText },
      { title: "Водители", url: "/admin/drivers", icon: Car },
      { title: "Пользователи", url: "/admin/users", icon: Users },
      { title: "Тарифы", url: "/admin/tariffs", icon: BadgeRussianRuble },
      { title: "Города", url: "/admin/cities", icon: Building2 },
      { title: "Рассылка", url: "/admin/notifications", icon: Bell },
      { title: "Поддержка", url: "/admin/support", icon: Headphones },
      { title: "Запросы бонусов", url: "/admin/bonus-requests", icon: Wallet },
      { title: "Настройки", url: "/admin/settings", icon: Settings },
      { title: "Обслуживание", url: "/admin/maintenance", icon: Server },
    ];
  }

  return (
    <div className="w-56 h-screen bg-[#0a0a14] border-r border-white/[0.06] flex flex-col shrink-0">
      <div className="h-14 flex items-center px-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="TAXI IMPULSE" className="w-11 h-11 object-contain brightness-125 saturate-150" />
          <span className="text-sm font-bold text-white tracking-wide">TAXI IMPULSE</span>
        </div>
      </div>

      <div className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
        {items.map((item) => {
          const isActive = location === item.url || (item.url !== "/" && location.startsWith(item.url + "/"));
          return (
            <Link key={item.url} href={item.url}>
              <div className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all cursor-pointer text-sm",
                isActive
                  ? "bg-violet-600/20 text-violet-300"
                  : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
              )}>
                <item.icon className={cn("w-4 h-4 flex-shrink-0", isActive ? "text-violet-400" : "")} />
                <span className="flex-1">{item.title}</span>
                {item.badge}
              </div>
            </Link>
          );
        })}
      </div>

      <div className="p-3 border-t border-white/[0.06]">
        <div className="flex items-center gap-2.5 px-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-violet-600/30 flex items-center justify-center text-violet-300 text-xs font-bold flex-shrink-0">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-medium text-white truncate">{user.name}</div>
            <div className="text-xs text-white/30 truncate">{user.phone}</div>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all"
        >
          <LogOut className="w-3.5 h-3.5" /> Выйти
        </button>
      </div>
    </div>
  );
}
