import { ReactNode, useState } from "react";
import { Sidebar } from "./sidebar";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface MainLayoutProps {
  children: ReactNode;
  allowedRoles?: string[];
}

export function MainLayout({ children, allowedRoles }: MainLayoutProps) {
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!user) return <Redirect to="/login" />;

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (user.role === 'admin') return <Redirect to="/admin" />;
    if (user.role === 'city_admin') return <Redirect to="/admin" />;
    if (user.role === 'delivery_admin') return <Redirect to="/admin/delivery-orders" />;
    if (user.role === 'driver') return <Redirect to="/driver" />;
    return <Redirect to="/passenger" />;
  }

  return (
    <div className="flex h-screen bg-[#07070f] overflow-hidden">
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-[#0a0a14]/90 backdrop-blur-md border-b border-white/[0.06] z-40 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="TAXI IMPULSE" className="w-11 h-11 object-contain brightness-125 saturate-150" />
          <span className="text-sm font-bold text-white">TAXI IMPULSE</span>
        </div>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-white/60 hover:text-white transition-colors">
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-out md:relative md:translate-x-0 hidden md:flex",
        mobileMenuOpen ? "translate-x-0 flex" : "-translate-x-full"
      )}>
        <Sidebar />
      </div>

      {/* Mobile backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/70 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden w-full pt-14 md:pt-0">
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-7xl mx-auto w-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
