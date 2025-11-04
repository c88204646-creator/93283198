import { 
  LayoutDashboard, 
  Users, 
  Building2, 
  FileText, 
  DollarSign, 
  Receipt, 
  UserCircle, 
  TrendingUp,
  Package,
  LogOut,
  Truck
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

interface MenuItem {
  title: string;
  url: string;
  icon: any;
  roles?: string[]; // If specified, only these roles can see this item
}

const menuItems: MenuItem[] = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Shipments",
    url: "/operations",
    icon: Package,
  },
  {
    title: "Clients",
    url: "/clients",
    icon: Building2,
  },
  {
    title: "Staff",
    url: "/employees",
    icon: UserCircle,
    roles: ["admin", "manager"],
  },
  {
    title: "Invoices",
    url: "/invoices",
    icon: FileText,
  },
  {
    title: "Quotes",
    url: "/proposals",
    icon: DollarSign,
  },
  {
    title: "Expenses",
    url: "/expenses",
    icon: Receipt,
  },
  {
    title: "Leads",
    url: "/leads",
    icon: TrendingUp,
  },
  {
    title: "Custom Fields",
    url: "/custom-fields",
    icon: Users,
    roles: ["admin"],
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const filteredMenuItems = menuItems.filter((item) => {
    if (!item.roles) return true;
    return user?.role && item.roles.includes(user.role);
  });

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarContent className="gap-0 bg-sidebar">
        <div className="px-6 py-8 border-b border-sidebar-border/50">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shrink-0 shadow-lg shadow-primary/25">
                <Truck className="w-7 h-7 text-primary-foreground" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-sidebar-foreground tracking-tight">NNEXIO</h1>
              <p className="text-xs text-sidebar-foreground/60 mt-0.5 font-medium">Control Panel</p>
            </div>
          </div>
        </div>

        <SidebarGroup className="px-3 py-4">
          <SidebarGroupLabel className="px-3 py-2 text-[10px] uppercase tracking-widest text-sidebar-foreground/50 font-semibold">
            Main Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {filteredMenuItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild 
                      isActive={isActive} 
                      data-testid={`link-sidebar-${item.title.toLowerCase()}`}
                      className={`
                        h-11 rounded-lg transition-all duration-200
                        ${isActive 
                          ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-md hover:bg-sidebar-primary/90' 
                          : 'hover:bg-sidebar-accent text-sidebar-foreground/70 hover:text-sidebar-foreground'
                        }
                      `}
                    >
                      <Link href={item.url} className="flex items-center gap-3 px-3">
                        <item.icon className={`w-5 h-5 ${isActive ? 'text-sidebar-primary-foreground' : ''}`} />
                        <span className="font-medium text-sm">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border/50 bg-sidebar">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-sidebar-accent/50">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-white font-semibold shadow-md">
            {user?.fullName?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-sidebar-foreground truncate">{user?.fullName}</p>
            <p className="text-xs text-sidebar-foreground/60 capitalize font-medium">{user?.role}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => logout()}
            className="shrink-0 h-9 w-9 hover:bg-sidebar-accent text-sidebar-foreground/70 hover:text-sidebar-foreground"
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
