import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  Container,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Wrench,
  Plus,
  Package2,
  Search,
  FileSpreadsheet,
  Settings,
  BookOpen,
  MapPin,
  TrendingDown
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

const quickActions = [
  {
    title: "Create Shipment",
    description: "Add a new shipment to the system",
    icon: Package2,
    url: "/operations",
  },
  {
    title: "Track Package",
    description: "Track existing shipments",
    icon: Search,
    url: "/operations",
  },
  {
    title: "Add Client",
    description: "Register a new client",
    icon: Users,
    url: "/clients",
  },
  {
    title: "Generate Report",
    description: "Create performance reports",
    icon: FileSpreadsheet,
    url: "/reports",
  },
  {
    title: "System Settings",
    description: "Configure system preferences",
    icon: Settings,
    url: "/settings",
  },
  {
    title: "Documentation",
    description: "Access help and guides",
    icon: BookOpen,
    url: "/help",
  },
];

const recentActivities = [
  {
    user: "John Doe",
    initials: "JD",
    action: "New shipment created",
    description: "Shipment #SH-2024-001 from New York to Los Angeles",
    time: "2 minutes ago",
  },
  {
    user: "Sarah Wilson",
    initials: "SW",
    action: "Delivery completed",
    description: "Package #PKG-789 delivered successfully to client",
    time: "15 minutes ago",
  },
  {
    user: "Mike Johnson",
    initials: "MJ",
    action: "Vehicle maintenance due",
    description: "Truck TRK-042 requires scheduled maintenance",
    time: "1 hour ago",
  },
  {
    user: "Emily Chen",
    initials: "EC",
    action: "Shipment delayed",
    description: "SH-2024-002 delayed due to weather conditions",
    time: "2 hours ago",
  },
  {
    user: "David Brown",
    initials: "DB",
    action: "Route optimized",
    description: "Delivery route updated for better efficiency",
    time: "3 hours ago",
  },
];

export default function DashboardPage() {
  const { user } = useAuth();

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  const activeShipments = stats?.operations.active ?? 42;
  const totalClients = stats?.clients.total ?? 1247;
  const totalInvoices = stats?.invoices.total ?? 156;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard Overview</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back! Here's what's happening with your logistics operations.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/fleet/vehicles">
            <Button variant="outline" data-testid="button-add-vehicle">
              <Truck className="w-4 h-4 mr-2" />
              Add Vehicle
            </Button>
          </Link>
          <Link href="/operations">
            <Button data-testid="button-new-shipment">
              <Plus className="w-4 h-4 mr-2" />
              New Shipment
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Shipments</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeShipments}</div>
            <p className="text-xs text-muted-foreground">Currently in transit</p>
            <div className="flex items-center text-xs text-green-600 dark:text-green-400 mt-1">
              <ArrowUp className="w-3 h-3 mr-1" />
              +12%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delivered Today</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">28</div>
            <p className="text-xs text-muted-foreground">Successful deliveries</p>
            <div className="flex items-center text-xs text-green-600 dark:text-green-400 mt-1">
              <ArrowUp className="w-3 h-3 mr-1" />
              +8%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Orders</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalInvoices}</div>
            <p className="text-xs text-muted-foreground">Awaiting processing</p>
            <div className="flex items-center text-xs text-red-600 dark:text-red-400 mt-1">
              <ArrowDown className="w-3 h-3 mr-1" />
              -5%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue (MTD)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$284,590</div>
            <p className="text-xs text-muted-foreground">Month to date</p>
            <div className="flex items-center text-xs text-green-600 dark:text-green-400 mt-1">
              <ArrowUp className="w-3 h-3 mr-1" />
              +15%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fleet Utilization</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">87%</div>
            <p className="text-xs text-muted-foreground">Vehicle efficiency</p>
            <div className="flex items-center text-xs text-green-600 dark:text-green-400 mt-1">
              <ArrowUp className="w-3 h-3 mr-1" />
              +3%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Clients</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalClients}</div>
            <p className="text-xs text-muted-foreground">Total active clients</p>
            <div className="flex items-center text-xs text-green-600 dark:text-green-400 mt-1">
              <ArrowUp className="w-3 h-3 mr-1" />
              +23%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Warehouse Capacity</CardTitle>
            <Container className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">73%</div>
            <p className="text-xs text-muted-foreground">Average utilization</p>
            <div className="flex items-center text-xs text-red-600 dark:text-red-400 mt-1">
              <ArrowDown className="w-3 h-3 mr-1" />
              -2%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delayed Shipments</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">7</div>
            <p className="text-xs text-muted-foreground">Requiring attention</p>
            <div className="flex items-center text-xs text-green-600 dark:text-green-400 mt-1">
              <TrendingDown className="w-3 h-3 mr-1" />
              -12%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fleet Status & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Fleet Status */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Fleet Status Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Total Vehicles</span>
                <span className="font-bold">45</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Efficiency</span>
                <span className="font-bold">87%</span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="text-sm">Active</span>
                </div>
                <span className="text-sm font-medium">32 (71%)</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <span className="text-sm">Maintenance</span>
                </div>
                <span className="text-sm font-medium">8 (18%)</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span className="text-sm">Available</span>
                </div>
                <span className="text-sm font-medium">5 (11%)</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivities.map((activity, index) => (
                <div key={index} className="flex items-start gap-4">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {activity.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium">{activity.action}</p>
                    <p className="text-xs text-muted-foreground">{activity.description}</p>
                    <p className="text-xs text-muted-foreground">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.title} href={action.url}>
                <Card className="hover-elevate active-elevate-2 cursor-pointer transition-all">
                  <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-sm">{action.title}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">{action.description}</p>
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Performance & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance Highlights */}
        <Card>
          <CardHeader>
            <CardTitle>Performance Highlights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">On-time Delivery Rate</span>
              <span className="text-lg font-bold">94.2%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Customer Satisfaction</span>
              <span className="text-lg font-bold">4.8/5.0</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Average Delivery Time</span>
              <span className="text-lg font-bold">2.3 days</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Cost per Mile</span>
              <span className="text-lg font-bold">$1.85</span>
            </div>
          </CardContent>
        </Card>

        {/* Alerts & Notifications */}
        <Card>
          <CardHeader>
            <CardTitle>Alerts & Notifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/30">
              <Wrench className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Maintenance Due</p>
                <p className="text-xs text-muted-foreground">3 vehicles require service</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/30">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Delayed Shipments</p>
                <p className="text-xs text-muted-foreground">7 shipments behind schedule</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30">
              <Package className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Low Inventory</p>
                <p className="text-xs text-muted-foreground">2 warehouses need restocking</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}