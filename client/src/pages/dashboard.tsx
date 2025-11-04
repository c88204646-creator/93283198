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
  operations: number;
  clients: number;
  employees: number;
  invoices: number;
  proposals: number;
  expenses: number;
  leads: number;
}

const moduleCards = [
  {
    title: "Shipments",
    description: "Active freight operations",
    icon: Package,
    url: "/operations",
    color: "text-white",
    bgColor: "bg-blue-500",
    statsKey: "operations" as const,
  },
  {
    title: "Clients",
    description: "Customer accounts",
    icon: Building2,
    url: "/clients",
    color: "text-white",
    bgColor: "bg-emerald-500",
    statsKey: "clients" as const,
  },
  {
    title: "Staff",
    description: "Team members",
    icon: UserCircle,
    url: "/employees",
    color: "text-white",
    bgColor: "bg-violet-500",
    statsKey: "employees" as const,
    roles: ["admin", "manager"],
  },
  {
    title: "Invoices",
    description: "Billing & payments",
    icon: FileText,
    url: "/invoices",
    color: "text-white",
    bgColor: "bg-orange-500",
    statsKey: "invoices" as const,
  },
  {
    title: "Quotes",
    description: "Freight quotations",
    icon: DollarSign,
    url: "/proposals",
    color: "text-white",
    bgColor: "bg-amber-500",
    statsKey: "proposals" as const,
  },
  {
    title: "Expenses",
    description: "Operational costs",
    icon: Receipt,
    url: "/expenses",
    color: "text-white",
    bgColor: "bg-rose-500",
    statsKey: "expenses" as const,
  },
  {
    title: "Leads",
    description: "New opportunities",
    icon: TrendingUp,
    url: "/leads",
    color: "text-white",
    bgColor: "bg-cyan-500",
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
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Dashboard Overview
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Welcome back, <span className="font-medium text-foreground">{user?.fullName}</span>
          </p>
        </div>
        <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-white font-semibold text-sm shadow-sm">
          {user?.fullName?.charAt(0).toUpperCase()}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCards.map((card) => {
          const count = stats?.[card.statsKey] ?? 0;
          const Icon = card.icon;

          return (
            <Link key={card.title} href={card.url}>
              <Card className="group hover:shadow-lg transition-all duration-200 border overflow-hidden bg-card hover:border-primary/50">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-sm font-semibold text-foreground/90 mb-1">
                        {card.title}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {card.description}
                      </p>
                    </div>
                    <div className={`p-2.5 rounded-lg ${card.bgColor} shadow-sm`}>
                      <Icon className={`w-5 h-5 ${card.color}`} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-end justify-between">
                    <div className="text-3xl font-bold text-foreground">
                      {isLoading ? (
                        <Skeleton className="h-10 w-16" />
                      ) : (
                        count
                      )}
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
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