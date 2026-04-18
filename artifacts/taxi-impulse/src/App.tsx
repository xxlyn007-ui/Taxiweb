import { Component, type ReactNode } from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Register from "@/pages/register";
import RegisterDriver from "@/pages/register-driver";
import PassengerDashboard from "@/pages/passenger/dashboard";
import PassengerHistory from "@/pages/passenger/history";
import PassengerRideshare from "@/pages/passenger/rideshare";
import PassengerReferral from "@/pages/passenger/referral";
import DriverDashboard from "@/pages/driver/dashboard";
import AvailableOrders from "@/pages/driver/orders";
import DriverContract from "@/pages/driver/contract";
import DriverRideshare from "@/pages/driver/rideshare";
import AdminDashboard from "@/pages/admin/dashboard";
import AdminOrders from "@/pages/admin/orders";
import AdminTariffs from "@/pages/admin/tariffs";
import AdminDrivers from "@/pages/admin/drivers";
import AdminSupport from "@/pages/admin/support";
import AdminSettings from "@/pages/admin/settings";
import AdminCities from "@/pages/admin/cities";
import AdminNotifications from "@/pages/admin/notifications";
import AdminUsers from "@/pages/admin/users";
import AdminBonusRequests from "@/pages/admin/bonus-requests";
import AdminMaintenance from "@/pages/admin/maintenance";
import CityAdmins from "@/pages/admin/city-admins";
import DeliveryOrders from "@/pages/admin/delivery-orders";
import AdminPayoutRequests from "@/pages/admin/payout-requests";
import DriverDeliveryPayout from "@/pages/driver/delivery-payout";
import SupportPage from "@/pages/support";
import TermsPage from "@/pages/terms";
import AccountPage from "@/pages/account";
import { InstallPrompt } from "@/components/install-prompt";

// Применяем тему до рендера (избегаем мигания)
try {
  const t = localStorage.getItem("taxi_theme") || "dark";
  if (t === "light") document.documentElement.classList.add("theme-light");
  else document.documentElement.classList.remove("theme-light");
} catch {}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

// ── ErrorBoundary — ловит крэши рендера, показывает кнопку перезагрузки вместо чёрного экрана
interface EBState { error: Error | null }
class ErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error): EBState {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error("[ErrorBoundary]", error.message, error.stack);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-[#0a0a1a] flex items-center justify-center p-6">
          <div className="text-center max-w-sm">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-white text-lg font-semibold mb-2">Что-то пошло не так</h2>
            <p className="text-white/40 text-sm mb-6">Произошла ошибка при загрузке страницы</p>
            <button
              onClick={() => { this.setState({ error: null }); window.location.href = "/"; }}
              className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors"
            >
              Вернуться на главную
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function RootRedirect() {
  const { user } = useAuth();
  if (!user) return <Redirect to="/login" />;
  if (user.role === "admin" || user.role === "city_admin") return <Redirect to="/admin" />;
  if (user.role === "delivery_admin") return <Redirect to="/admin/delivery-orders" />;
  if (user.role === "driver") return <Redirect to="/driver" />;
  return <Redirect to="/passenger" />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={RootRedirect} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/register-driver" component={RegisterDriver} />

      <Route path="/passenger" component={PassengerDashboard} />
      <Route path="/passenger/history" component={PassengerHistory} />
      <Route path="/passenger/rideshare" component={PassengerRideshare} />
      <Route path="/passenger/referral" component={PassengerReferral} />

      <Route path="/driver" component={DriverDashboard} />
      <Route path="/driver/orders" component={AvailableOrders} />
      <Route path="/driver/contract" component={DriverContract} />
              <Route path="/driver/delivery-payout" component={DriverDeliveryPayout} />
      <Route path="/driver/rideshare" component={DriverRideshare} />

      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/orders" component={AdminOrders} />
      <Route path="/admin/tariffs" component={AdminTariffs} />
      <Route path="/admin/drivers" component={AdminDrivers} />
      <Route path="/admin/support" component={AdminSupport} />
      <Route path="/admin/settings" component={AdminSettings} />
      <Route path="/admin/cities" component={AdminCities} />
      <Route path="/admin/notifications" component={AdminNotifications} />
      <Route path="/admin/users" component={AdminUsers} />
      <Route path="/admin/bonus-requests" component={AdminBonusRequests} />
      <Route path="/admin/maintenance" component={AdminMaintenance} />
              <Route path="/admin/city-admins" component={CityAdmins} />
              <Route path="/admin/delivery-orders" component={DeliveryOrders} />
              <Route path="/admin/payout-requests" component={AdminPayoutRequests} />

      <Route path="/account" component={AccountPage} />
      <Route path="/support" component={SupportPage} />
      <Route path="/terms" component={TermsPage} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <InstallPrompt>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <AuthProvider>
                <ErrorBoundary>
                  <Router />
                </ErrorBoundary>
              </AuthProvider>
            </WouterRouter>
            <Toaster />
          </InstallPrompt>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
