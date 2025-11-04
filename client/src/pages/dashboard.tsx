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
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Dashboard Overview
          </h1>
          <p className="text-muted-foreground mt-2 text-base">
            Welcome back, <span className="font-semibold text-foreground">{user?.fullName}</span>. Here's your logistics control center.
          </p>
        </div>
        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-white font-bold text-lg shadow-lg">
          {user?.fullName?.charAt(0).toUpperCase()}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCards.map((card) => {
          const count = stats?.[card.statsKey] ?? 0;
          const Icon = card.icon;

          return (
            <Link key={card.title} href={card.url}>
              <Card className="group hover:shadow-xl transition-all duration-300 border-0 overflow-hidden bg-card/80 backdrop-blur-sm hover:scale-[1.02]">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-base font-semibold text-foreground mb-1">
                        {card.title}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {card.description}
                      </p>
                    </div>
                    <div className={`p-3 rounded-xl ${card.bgColor} shadow-lg group-hover:scale-110 transition-transform`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-end justify-between">
                    <div className="text-4xl font-bold bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
                      {count}
                    </div>
                    <div className="text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                      View all →
                    </div>
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