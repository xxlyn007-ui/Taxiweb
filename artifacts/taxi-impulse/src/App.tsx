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
import DriverDashboard from "@/pages/driver/dashboard";
import AvailableOrders from "@/pages/driver/orders";
import DriverContract from "@/pages/driver/contract";
import AdminDashboard from "@/pages/admin/dashboard";
import AdminOrders from "@/pages/admin/orders";
import AdminTariffs from "@/pages/admin/tariffs";
import AdminDrivers from "@/pages/admin/drivers";
import AdminSupport from "@/pages/admin/support";
import AdminSettings from "@/pages/admin/settings";
import AdminCities from "@/pages/admin/cities";
import AdminNotifications from "@/pages/admin/notifications";
import AdminUsers from "@/pages/admin/users";
import SupportPage from "@/pages/support";
import TermsPage from "@/pages/terms";
import { MainLayout } from "@/components/layout/main-layout";
import { InstallPrompt } from "@/components/install-prompt";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    }
  }
});

function RootRedirect() {
  const { user } = useAuth();
  if (!user) return <Redirect to="/login" />;
  if (user.role === "admin") return <Redirect to="/admin" />;
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

      <Route path="/driver" component={DriverDashboard} />
      <Route path="/driver/orders" component={AvailableOrders} />
      <Route path="/driver/contract" component={DriverContract} />

      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/orders" component={AdminOrders} />
      <Route path="/admin/tariffs" component={AdminTariffs} />
      <Route path="/admin/drivers" component={AdminDrivers} />
      <Route path="/admin/support" component={AdminSupport} />
      <Route path="/admin/settings" component={AdminSettings} />
      <Route path="/admin/cities" component={AdminCities} />
      <Route path="/admin/notifications" component={AdminNotifications} />
      <Route path="/support" component={SupportPage} />
      <Route path="/terms" component={TermsPage} />

      <Route path="/admin/users" component={AdminUsers} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <InstallPrompt>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AuthProvider>
              <Router />
            </AuthProvider>
          </WouterRouter>
          <Toaster />
        </InstallPrompt>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
