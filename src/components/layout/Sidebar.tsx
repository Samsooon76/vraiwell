import { motion } from "framer-motion";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { 
  LayoutGrid, 
  FileText, 
  BarChart3, 
  Settings, 
  Users,
  Plug,
  Workflow,
  LogOut,
  ChevronLeft
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { useState } from "react";

const navigation = [
  { name: "Bibliothèque", href: "/dashboard", icon: LayoutGrid },
  { name: "Demandes", href: "/dashboard/requests", icon: FileText },
  { name: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { name: "Équipes", href: "/dashboard/teams", icon: Users },
  { name: "Intégrations", href: "/dashboard/integrations", icon: Plug },
  { name: "Workflows", href: "/dashboard/workflows", icon: Workflow },
];

const secondaryNav = [
  { name: "Paramètres", href: "/dashboard/settings", icon: Settings },
];

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (value: boolean) => void;
}

export function Sidebar({ isCollapsed, setIsCollapsed }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <motion.aside
      initial={{ width: 256 }}
      animate={{ width: isCollapsed ? 72 : 256 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      onMouseEnter={() => setIsCollapsed(false)}
      onMouseLeave={() => setIsCollapsed(true)}
      className="fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-border bg-sidebar overflow-hidden"
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 px-4 border-b border-border">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary shrink-0">
          <span className="font-display text-lg font-bold text-primary-foreground">W</span>
        </div>
        <motion.span 
          animate={{ opacity: isCollapsed ? 0 : 1 }}
          className="font-display text-xl font-bold text-foreground whitespace-nowrap"
        >
          Well
        </motion.span>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
        <motion.p 
          animate={{ opacity: isCollapsed ? 0 : 1 }}
          className="mb-3 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap"
        >
          Menu principal
        </motion.p>
        {navigation.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className={cn(
                "h-5 w-5 shrink-0 transition-colors",
                isActive ? "text-sidebar-primary" : "text-muted-foreground group-hover:text-sidebar-primary"
              )} />
              <motion.span 
                animate={{ opacity: isCollapsed ? 0 : 1 }}
                className="whitespace-nowrap"
              >
                {item.name}
              </motion.span>
              {isActive && !isCollapsed && (
                <motion.div
                  layoutId="activeNav"
                  className="ml-auto h-1.5 w-1.5 rounded-full bg-sidebar-primary"
                />
              )}
            </Link>
          );
        })}

        <div className="my-6 h-px bg-border" />

        <motion.p 
          animate={{ opacity: isCollapsed ? 0 : 1 }}
          className="mb-3 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap"
        >
          Configuration
        </motion.p>
        {secondaryNav.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="h-5 w-5 shrink-0 text-muted-foreground group-hover:text-sidebar-primary" />
              <motion.span 
                animate={{ opacity: isCollapsed ? 0 : 1 }}
                className="whitespace-nowrap"
              >
                {item.name}
              </motion.span>
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent shrink-0">
            <span className="text-sm font-medium text-accent-foreground">
              {user?.email?.charAt(0).toUpperCase() || "U"}
            </span>
          </div>
          <motion.div 
            animate={{ opacity: isCollapsed ? 0 : 1 }}
            className="flex-1 min-w-0"
          >
            <p className="truncate text-sm font-medium text-foreground">
              {user?.email?.split("@")[0] || "Utilisateur"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {user?.email || ""}
            </p>
          </motion.div>
          {!isCollapsed && (
            <button 
              onClick={handleSignOut}
              className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors shrink-0"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </motion.aside>
  );
}
