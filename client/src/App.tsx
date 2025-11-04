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
import OperationsPage from "@/pages/operations";
import ClientsPage from "@/pages/clients";
import EmployeesPage from "@/pages/employees";
import InvoicesPage from "@/pages/invoices";
import ProposalsPage from "@/pages/proposals";
import ExpensesPage from "@/pages/expenses";
import LeadsPage from "@/pages/leads";
import CustomFieldsPage from "@/pages/custom-fields";

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
  const style = {
    "--sidebar-width": "18rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between px-6 py-3 border-b border-border bg-card shrink-0">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto p-6 bg-background">
            <div className="max-w-7xl mx-auto">
              <Switch>
                <Route path="/dashboard" component={() => <ProtectedRoute component={DashboardPage} />} />
                <Route path="/operations" component={() => <ProtectedRoute component={OperationsPage} />} />
                <Route path="/clients" component={() => <ProtectedRoute component={ClientsPage} />} />
                <Route path="/employees" component={() => <ProtectedRoute component={EmployeesPage} />} />
                <Route path="/invoices" component={() => <ProtectedRoute component={InvoicesPage} />} />
                <Route path="/proposals" component={() => <ProtectedRoute component={ProposalsPage} />} />
                <Route path="/expenses" component={() => <ProtectedRoute component={ExpensesPage} />} />
                <Route path="/leads" component={() => <ProtectedRoute component={LeadsPage} />} />
                <Route path="/custom-fields" component={() => <ProtectedRoute component={CustomFieldsPage} />} />
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
      <ThemeProvider defaultTheme="light" storageKey="logisticore-theme">
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
