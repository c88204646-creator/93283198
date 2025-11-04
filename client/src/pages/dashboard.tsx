import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  LayoutDashboard, 
  Users, 
  Building2, 
  FileText, 
  DollarSign, 
  Receipt, 
  UserCircle, 
  TrendingUp,
  ArrowUpRight,
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
    title: "Operations",
    icon: LayoutDashboard,
    url: "/operations",
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
    statsKey: "operations" as const,
  },
  {
    title: "Clients",
    icon: Building2,
    url: "/clients",
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-50 dark:bg-green-950/30",
    statsKey: "clients" as const,
  },
  {
    title: "Employees",
    icon: UserCircle,
    url: "/employees",
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-50 dark:bg-purple-950/30",
    statsKey: "employees" as const,
    roles: ["admin", "manager"],
  },
  {
    title: "Invoices",
    icon: FileText,
    url: "/invoices",
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-50 dark:bg-orange-950/30",
    statsKey: "invoices" as const,
  },
  {
    title: "Proposals",
    icon: DollarSign,
    url: "/proposals",
    color: "text-yellow-600 dark:text-yellow-400",
    bgColor: "bg-yellow-50 dark:bg-yellow-950/30",
    statsKey: "proposals" as const,
  },
  {
    title: "Expenses",
    icon: Receipt,
    url: "/expenses",
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-50 dark:bg-red-950/30",
    statsKey: "expenses" as const,
  },
  {
    title: "Leads",
    icon: TrendingUp,
    url: "/leads",
    color: "text-pink-600 dark:text-pink-400",
    bgColor: "bg-pink-50 dark:bg-pink-950/30",
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome back, {user?.fullName}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCards.map((card) => {
          const Icon = card.icon;
          const moduleStats = stats?.[card.statsKey];
          
          return (
            <Link key={card.title} href={card.url}>
              <Card className="hover-elevate active-elevate-2 cursor-pointer transition-all" data-testid={`card-module-${card.title.toLowerCase()}`}>
                <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
                  <CardTitle className="text-base font-medium">{card.title}</CardTitle>
                  <div className={`w-10 h-10 rounded-md ${card.bgColor} flex items-center justify-center shrink-0`}>
                    <Icon className={`w-5 h-5 ${card.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-8 w-16" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  ) : (
                    <>
                      <div className="text-2xl font-semibold" data-testid={`text-${card.statsKey}-total`}>
                        {moduleStats?.total || 0}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {card.statsKey === "operations" && `${moduleStats?.active || 0} active`}
                        {card.statsKey === "clients" && `${moduleStats?.active || 0} active`}
                        {card.statsKey === "employees" && `${moduleStats?.active || 0} active`}
                        {card.statsKey === "invoices" && `${moduleStats?.paid || 0} paid, ${moduleStats?.pending || 0} pending`}
                        {card.statsKey === "proposals" && `${moduleStats?.pending || 0} pending`}
                        {card.statsKey === "expenses" && `${moduleStats?.pending || 0} pending approval`}
                        {card.statsKey === "leads" && `${moduleStats?.new || 0} new this month`}
                      </p>
                    </>
                  )}
                  <div className="flex items-center text-xs text-primary mt-3">
                    View all <ArrowUpRight className="w-3 h-3 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
