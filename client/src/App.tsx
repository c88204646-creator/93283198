import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import OperationsPage from "./pages/operations";
import OperationsCreatePage from "./pages/operations-create";
import MapPage from "./pages/map";
import ClientsPage from "./pages/clients";
import EmployeesPage from "./pages/employees";
import InvoicesPage from "./pages/invoices";
import ProposalsPage from "./pages/proposals";
import ExpensesPage from "./pages/expenses";
import LeadsPage from "./pages/leads";
import CustomFieldsPage from "./pages/custom-fields";
import GmailPage from "./pages/gmail";
import CalendarPage from "./pages/calendar";
import AutomationPage from "./pages/automation";

function ProtectedRoute({ component: Component }: { component: () => JSX.Element }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  return <Component />;
}

function RootRedirect() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return user ? <Redirect to="/dashboard" /> : <Redirect to="/login" />;
}

function AppLayout() {
  const { user, isLoading } = useAuth();
  const style = {
    "--sidebar-width": "18rem",
    "--sidebar-width-icon": "4rem",
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between px-6 py-3.5 border-b border-border bg-card shrink-0">
            <div className="flex items-center gap-3">
              <SidebarTrigger data-testid="button-sidebar-toggle" className="hover:bg-accent" />
              <div className="h-5 w-px bg-border"></div>
              <h2 className="text-sm font-medium text-foreground/70">Logistics Control Center</h2>
            </div>
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto p-6 bg-background">
            <div className="max-w-7xl mx-auto">
              <Switch>
                <Route path="/dashboard" component={DashboardPage} />
                <Route path="/operations" component={OperationsPage} />
                <Route path="/operations/create" component={OperationsCreatePage} />
                <Route path="/map" component={MapPage} />
                <Route path="/clients" component={ClientsPage} />
                <Route path="/employees" component={EmployeesPage} />
                <Route path="/invoices" component={InvoicesPage} />
                <Route path="/proposals" component={ProposalsPage} />
                <Route path="/expenses" component={ExpensesPage} />
                <Route path="/leads" component={LeadsPage} />
                <Route path="/custom-fields" component={CustomFieldsPage} />
                <Route path="/gmail" component={GmailPage} />
                <Route path="/calendar" component={CalendarPage} />
                <Route path="/automation" component={AutomationPage} />
                <Route path="/" component={RootRedirect} />
                <Route component={NotFound} />
              </Switch>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route component={AppLayout} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="logisticore-theme">
        <AuthProvider>
          <TooltipProvider>
            <Router />
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;