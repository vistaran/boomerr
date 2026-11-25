import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Activity,
  Settings,
  LogOut,
  CreditCard,
  Globe,
  Shield,
  Server,
  ShieldAlert,
  Mail,
  GitBranch,
  ChevronDown,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { useAdminAuth } from "../../../context/admin-auth-context";

interface NavSubItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavItem {
  name: string;
  path?: string;
  icon: React.ComponentType<{ className?: string }>;
  subItems?: NavSubItem[];
}

export const AdminSidebar = () => {
  const location = useLocation();
  const { logoutAdmin } = useAdminAuth();

  const isEmailRoute = location.pathname.startsWith("/admin/email");
  const [emailOpen, setEmailOpen] = useState(true);

  // Auto-expand if navigating into any email subroute
  useEffect(() => {
    if (isEmailRoute) {
      setEmailOpen(true);
    }
  }, [isEmailRoute]);

  const navItems: NavItem[] = [
    { name: "Dashboard", path: "/admin/dashboard", icon: LayoutDashboard },
    { name: "Node Health", path: "/admin/node-health", icon: Server },
    { name: "Platform Incidents", path: "/admin/boomerr-incidents", icon: ShieldAlert },
    { name: "Public Status Page", path: "/admin/status-page", icon: Globe },
    { name: "Announce Features", path: "/admin/features", icon: Sparkles },
    { name: "Users", path: "/admin/users", icon: Users },
    {
      name: "Emails",
      icon: Mail,
      subItems: [
        { name: "Email Templates", path: "/admin/email/templates", icon: Mail },
        { name: "Email Sequences", path: "/admin/email/sequence", icon: GitBranch },
      ],
    },
    { name: "Admins", path: "/admin/admins", icon: Shield },
    { name: "Billing", path: "/admin/billing", icon: CreditCard },
    { name: "System Logs", path: "/admin/logs", icon: Activity },
    { name: "Settings", path: "/admin/settings", icon: Settings },
  ];

  return (
    <div className="w-64 bg-white dark:bg-[#0a0a0a] border-r border-slate-200 dark:border-slate-800 h-screen flex flex-col fixed left-0 top-0">
      <div className="p-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">B</span>
          </div>
          Boomerr Admin
        </h2>
      </div>

      <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto">
        {navItems.map((item) => {
          if (item.subItems) {
            return (
              <div key={item.name} className="space-y-1">
                <button
                  type="button"
                  onClick={() => setEmailOpen((prev) => !prev)}
                  className={`w-full flex items-center justify-between px-3 py-3 rounded-xl transition-all ${
                    isEmailRoute
                      ? "bg-blue-600/10 text-blue-400 font-medium"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.04] hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <item.icon className={`w-5 h-5 ${isEmailRoute ? "text-blue-400" : "text-slate-600 dark:text-slate-400 dark:text-slate-400"}`} />
                    <span>{item.name}</span>
                  </div>
                  {emailOpen ? (
                    <ChevronDown className={`w-4 h-4 transition-transform ${isEmailRoute ? "text-blue-400" : "text-slate-600 dark:text-slate-400 dark:text-slate-400"}`} />
                  ) : (
                    <ChevronRight className={`w-4 h-4 transition-transform ${isEmailRoute ? "text-blue-400" : "text-slate-600 dark:text-slate-400 dark:text-slate-400"}`} />
                  )}
                </button>

                {emailOpen && (
                  <div className="pl-3 ml-4 border-l border-slate-200 dark:border-slate-800/80 space-y-1 pt-1 pb-1">
                    {item.subItems.map((sub) => {
                      const isSubActive = location.pathname.startsWith(sub.path);
                      return (
                        <Link
                          key={sub.path}
                          to={sub.path}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                            isSubActive
                              ? "bg-blue-600/15 text-blue-400 font-medium shadow-sm shadow-blue-500/10"
                              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.04] hover:text-slate-900 dark:hover:text-slate-200"
                          }`}
                          style={isSubActive ? { color: "#3B82F6" } : undefined}
                        >
                          <sub.icon className={`w-4 h-4 ${isSubActive ? "text-blue-400" : "text-slate-600 dark:text-slate-400 dark:text-slate-400"}`} />
                          <span>{sub.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          const isActive =
            item.path === "/admin/status-page"
              ? location.pathname === item.path
              : item.path
              ? location.pathname.startsWith(item.path)
              : false;

          return (
            <Link
              key={item.path || item.name}
              to={item.path || "#"}
              className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${
                isActive
                  ? "bg-blue-600/15 text-blue-400 font-medium"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.04] hover:text-slate-900 dark:hover:text-slate-200"
              }`}
              style={isActive ? { color: "#3B82F6" } : undefined}
            >
              <item.icon className={`w-5 h-5 ${isActive ? "text-blue-400" : "text-slate-600 dark:text-slate-400 dark:text-slate-400"}`} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-200 dark:border-slate-800">
        <button
          onClick={logoutAdmin}
          className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-slate-600 dark:text-slate-400 dark:text-slate-400 hover:bg-red-500/10 hover:text-red-500 transition-all"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>
      </div>
    </div>
  );
};
