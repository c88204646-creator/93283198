import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Package, 
  Users, 
  Building2, 
  FileText, 
  DollarSign, 
  Receipt, 
  UserCircle, 
  TrendingUp,
  ArrowUpRight,
  Ship,
  Plane,
  Truck,
  Container
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Skeleton } from "@/components/ui/skeleton";

interface DashboardStats {
  operations: { total: number; active: number };
  clients: { total: number; active: number };
  employees: { total: number; active: number };
  invoices: { total: number; pending: number; paid: number };
  proposals: { total: number; pending: number };
  expenses: { total: number; pending: number };
  leads: { total: number; new: number };
}

const moduleCards = [
  {
    title: "Shipments",
    description: "Active freight operations",
    icon: Package,
    url: "/operations",
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
    statsKey: "operations" as const,
  },
  {
    title: "Clients",
    description: "Customer accounts",
    icon: Building2,
    url: "/clients",
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-50 dark:bg-emerald-950/30",
    statsKey: "clients" as const,
  },
  {
    title: "Staff",
    description: "Team members",
    icon: UserCircle,
    url: "/employees",
    color: "text-violet-600 dark:text-violet-400",
    bgColor: "bg-violet-50 dark:bg-violet-950/30",
    statsKey: "employees" as const,
    roles: ["admin", "manager"],
  },
  {
    title: "Invoices",
    description: "Billing & payments",
    icon: FileText,
    url: "/invoices",
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-50 dark:bg-orange-950/30",
    statsKey: "invoices" as const,
  },
  {
    title: "Quotes",
    description: "Freight quotations",
    icon: DollarSign,
    url: "/proposals",
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-50 dark:bg-amber-950/30",
    statsKey: "proposals" as const,
  },
  {
    title: "Expenses",
    description: "Operational costs",
    icon: Receipt,
    url: "/expenses",
    color: "text-rose-600 dark:text-rose-400",
    bgColor: "bg-rose-50 dark:bg-rose-950/30",
    statsKey: "expenses" as const,
  },
  {
    title: "Leads",
    description: "New opportunities",
    icon: TrendingUp,
    url: "/leads",
    color: "text-cyan-600 dark:text-cyan-400",
    bgColor: "bg-cyan-50 dark:bg-cyan-950/30",
    statsKey: "leads" as const,
  },
];

export default function DashboardPage() {
  const { user } = useAuth();
  
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  const filteredCards = moduleCards.filter((card) => {
    if (!card.roles) return true;
    return user?.role && card.roles.includes(user.role);
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Logistics Dashboard</h1>
          <p className="text-muted-foreground mt-2">Welcome back, {user?.fullName}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-card-border">
            <Truck className="w-5 h-5 text-muted-foreground" />
            <Ship className="w-5 h-5 text-muted-foreground" />
            <Plane className="w-5 h-5 text-muted-foreground" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {filteredCards.map((card) => {
          const Icon = card.icon;
          const moduleStats = stats?.[card.statsKey];
          
          return (
            <Link key={card.title} href={card.url}>
              <Card className="hover-elevate active-elevate-2 cursor-pointer transition-all h-full" data-testid={`card-module-${card.title.toLowerCase()}`}>
                <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-3">
                  <div className="space-y-1">
                    <CardTitle className="text-lg font-semibold">{card.title}</CardTitle>
                    <p className="text-xs text-muted-foreground">{card.description}</p>
                  </div>
                  <div className={`w-12 h-12 rounded-lg ${card.bgColor} flex items-center justify-center shrink-0`}>
                    <Icon className={`w-6 h-6 ${card.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-9 w-20" />
                      <Skeleton className="h-4 w-28" />
                    </div>
                  ) : (
                    <>
                      <div className="text-3xl font-bold mb-2" data-testid={`text-${card.statsKey}-total`}>
                        {moduleStats?.total || 0}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {card.statsKey === "operations" && `${moduleStats && 'active' in moduleStats ? moduleStats.active : 0} in transit`}
                        {card.statsKey === "clients" && `${moduleStats && 'active' in moduleStats ? moduleStats.active : 0} active`}
                        {card.statsKey === "employees" && `${moduleStats && 'active' in moduleStats ? moduleStats.active : 0} active`}
                        {card.statsKey === "invoices" && `${moduleStats && 'paid' in moduleStats ? moduleStats.paid : 0} paid, ${moduleStats && 'pending' in moduleStats ? moduleStats.pending : 0} pending`}
                        {card.statsKey === "proposals" && `${moduleStats && 'pending' in moduleStats ? moduleStats.pending : 0} awaiting response`}
                        {card.statsKey === "expenses" && `${moduleStats && 'pending' in moduleStats ? moduleStats.pending : 0} pending`}
                        {card.statsKey === "leads" && `${moduleStats && 'new' in moduleStats ? moduleStats.new : 0} new this month`}
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
