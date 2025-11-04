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
        <div className="px-4 py-5 border-b border-sidebar-border/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shrink-0 shadow-sm">
              <Truck className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-sidebar-foreground tracking-tight">NNEXIO</h1>
              <p className="text-[10px] text-sidebar-foreground/50 mt-0 font-medium uppercase tracking-wider">Control Panel</p>
            </div>
          </div>
        </div>

        <SidebarGroup className="px-2 py-3">
          <SidebarGroupLabel className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-sidebar-foreground/40 font-semibold">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {filteredMenuItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild 
                      isActive={isActive} 
                      data-testid={`link-sidebar-${item.title.toLowerCase()}`}
                      className={`
                        h-10 rounded-md transition-all duration-150
                        ${isActive 
                          ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
                          : 'hover:bg-sidebar-accent text-sidebar-foreground/80 hover:text-sidebar-foreground'
                        }
                      `}
                    >
                      <Link href={item.url} className="flex items-center gap-2.5 px-3">
                        <item.icon className={`w-4 h-4 ${isActive ? 'text-primary-foreground' : ''}`} />
                        <span className="font-medium text-[13px]">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border/50 bg-sidebar">
        <div className="flex items-center gap-2.5 p-2.5 rounded-md bg-sidebar-accent/30">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-semibold text-xs shadow-sm">
            {user?.fullName?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-sidebar-foreground truncate">{user?.fullName}</p>
            <p className="text-[11px] text-sidebar-foreground/50 capitalize">{user?.role}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => logout()}
            className="shrink-0 h-8 w-8 hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground"
            data-testid="button-logout"
          >
            <LogOut className="w-3.5 h-3.5" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
