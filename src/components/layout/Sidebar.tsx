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
  LogOut
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

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

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <motion.aside
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-border bg-sidebar"
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 px-6 border-b border-border">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary">
          <span className="font-display text-lg font-bold text-primary-foreground">W</span>
        </div>
        <span className="font-display text-xl font-bold text-foreground">Well</span>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        <p className="mb-3 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Menu principal
        </p>
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
                "h-5 w-5 transition-colors",
                isActive ? "text-sidebar-primary" : "text-muted-foreground group-hover:text-sidebar-primary"
              )} />
              {item.name}
              {isActive && (
                <motion.div
                  layoutId="activeNav"
                  className="ml-auto h-1.5 w-1.5 rounded-full bg-sidebar-primary"
                />
              )}
            </Link>
          );
        })}

        <div className="my-6 h-px bg-border" />

        <p className="mb-3 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Configuration
        </p>
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
              <item.icon className="h-5 w-5 text-muted-foreground group-hover:text-sidebar-primary" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-border p-4">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent">
            <span className="text-sm font-medium text-accent-foreground">SA</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium text-foreground">Sabrina Admin</p>
            <p className="truncate text-xs text-muted-foreground">RevOps Lead</p>
          </div>
          <button className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.aside>
  );
}
