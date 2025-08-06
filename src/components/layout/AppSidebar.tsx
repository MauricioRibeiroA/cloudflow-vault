import { useState, useEffect } from "react";
import { useLocation, NavLink } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { 
  Home, 
  Users, 
  FileText, 
  HardDrive, 
  LogOut,
  Settings,
  Shield,
  Upload,
  Cog,
  Building2,
  Cloud,
  CreditCard,
  Crown,
  FolderLock,
  Timer
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/components/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface MenuItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredGroups?: string[];
}

const menuItems: MenuItem[] = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: Home,
  },
  {
    title: "Upload de Arquivos",
    url: "/upload",
    icon: Upload,
  },
  {
    title: "Backblaze B2",
    url: "/backblaze-b2",
    icon: Cloud,
  },
  {
    title: "Planos",
    url: "/plans",
    icon: CreditCard,
  },
  {
    title: "Trial Gratuito",
    url: "/trial",
    icon: Timer,
    requiredGroups: ["company_admin"],
  },
  {
    title: "Arquivos Seguros",
    url: "/secure-files",
    icon: FolderLock,
  },
  {
    title: "Colaboradores",
    url: "/admin",
    icon: Users,
    requiredGroups: ["company_admin", "super_admin", "hr"],
  },
  {
    title: "Empresas",
    url: "/companies",
    icon: Building2,
    requiredGroups: ["super_admin"],
  },
  {
    title: "Super Admin Dashboard",
    url: "/super-admin",
    icon: Crown,
    requiredGroups: ["super_admin"],
  },
  {
    title: "Regras de Negócio",
    url: "/business-rules",
    icon: Settings,
    requiredGroups: ["company_admin", "super_admin"],
  },
  {
    title: "Logs do Sistema",
    url: "/logs",
    icon: FileText,
    requiredGroups: ["company_admin", "super_admin"],
  },
  {
    title: "Backup",
    url: "/backup",
    icon: HardDrive,
    requiredGroups: ["company_admin", "super_admin"],
  },
  {
    title: "Configurações",
    url: "/settings",
    icon: Cog,
    requiredGroups: ["company_admin", "super_admin"],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const currentPath = location.pathname;

  const isActive = (path: string) => currentPath === path;

  const hasPermission = (requiredGroups?: string[]) => {
    if (!requiredGroups || !profile) return true;
    return requiredGroups.includes(profile.group_name);
  };

  const getUserInitials = () => {
    if (!profile?.full_name) return "U";
    return profile.full_name
      .split(" ")
      .map(name => name[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getGroupLabel = (groupName: string) => {
    const labels = {
      super_admin: "Super Admin",
      company_admin: "Admin da Empresa",
      hr: "RH",
      user: "Colaborador"
    };
    return labels[groupName as keyof typeof labels] || "Colaborador";
  };

  useEffect(() => {
    const fetchProfile = async () => {
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", user.id)
          .single();
        setProfile(data);
      }
    };
    fetchProfile();
  }, [user]);

  return (
    <Sidebar className={collapsed ? "w-14" : "w-64"} collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-sidebar-primary rounded-lg flex items-center justify-center">
            <Shield className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          {!collapsed && (
            <div>
              <h2 className="font-semibold text-sidebar-foreground">CloudFlow Vault</h2>
              <p className="text-xs text-sidebar-foreground/70">Sistema Corporativo</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems
                .filter(item => hasPermission(item.requiredGroups))
                .map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.url} 
                      end 
                      className={({ isActive }) =>
                        isActive 
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium flex items-center" 
                          : "hover:bg-sidebar-accent/50 flex items-center"
                      }
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        {profile && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-sm">
                  {getUserInitials()}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-sidebar-foreground truncate">
                    {profile.full_name}
                  </p>
                  <p className="text-xs text-sidebar-foreground/70 truncate">
                    {getGroupLabel(profile.group_name)}
                  </p>
                </div>
              )}
            </div>
            
            {!collapsed && (
              <Button
                variant="outline"
                size="sm"
                onClick={signOut}
                className="w-full justify-start"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </Button>
            )}
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}