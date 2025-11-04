
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
  Truck,
  Mail
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
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface MenuItem {
  title: string;
  url: string;
  icon: any;
  roles?: string[];
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
    title: "Gmail",
    url: "/gmail",
    icon: Mail,
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
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

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
            {!isCollapsed && (
              <div>
                <h1 className="text-xl font-bold text-sidebar-foreground tracking-tight">NNEXIO</h1>
                <p className="text-[10px] text-sidebar-foreground/50 mt-0 font-medium uppercase tracking-wider">Control Panel</p>
              </div>
            )}
          </div>
        </div>

        <SidebarGroup className="px-2 py-3">
          {!isCollapsed && (
            <SidebarGroupLabel className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-sidebar-foreground/40 font-semibold">
              Navigation
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {filteredMenuItems.map((item) => {
                const isActive = location === item.url;
                const ItemIcon = item.icon;
                
                return (
                  <SidebarMenuItem key={item.title}>
                    {isCollapsed ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Link href={item.url}>
                            <SidebarMenuButton 
                              isActive={isActive} 
                              data-testid={`link-sidebar-${item.title.toLowerCase()}`}
                              className={`
                                w-10 h-10 rounded-md transition-all duration-150 flex items-center justify-center
                                ${isActive 
                                  ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
                                  : 'hover:bg-sidebar-accent text-sidebar-foreground/80 hover:text-sidebar-foreground'
                                }
                              `}
                            >
                              <ItemIcon className="w-5 h-5 shrink-0" />
                            </SidebarMenuButton>
                          </Link>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          <p>{item.title}</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <SidebarMenuButton 
                        asChild 
                        isActive={isActive} 
                        data-testid={`link-sidebar-${item.title.toLowerCase()}`}
                        className={`
                          h-10 rounded-md transition-all duration-150 px-3
                          ${isActive 
                            ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
                            : 'hover:bg-sidebar-accent text-sidebar-foreground/80 hover:text-sidebar-foreground'
                          }
                        `}
                      >
                        <Link href={item.url} className="flex items-center gap-2.5 w-full">
                          <ItemIcon className="w-4 h-4 shrink-0" />
                          <span className="font-medium text-[13px]">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border/50 bg-sidebar">
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-semibold text-xs shadow-sm cursor-pointer">
                  {user?.fullName?.charAt(0).toUpperCase()}
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">
                <div>
                  <p className="font-medium">{user?.fullName}</p>
                  <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
                </div>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => logout()}
                  className="h-8 w-8 hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground"
                  data-testid="button-logout"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Logout</p>
              </TooltipContent>
            </Tooltip>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 p-2.5 rounded-md bg-sidebar-accent/30">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-semibold text-xs shadow-sm shrink-0">
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
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
