import React, { useState, useRef, useEffect } from "react";
import { useAdminAuth } from "../../../context/admin-auth-context";
import { Bell, LogOut, User, Sun, Moon } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAdminTheme } from "../../../context/admin-theme-context";

const AdminThemeToggle = () => {
  const { theme, toggleTheme } = useAdminTheme();
  
  return (
    <button
      onClick={toggleTheme}
      aria-label="Toggle Theme"
      title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
      className={`relative w-[68px] h-[32px] rounded-full flex items-center transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
        theme === 'dark' 
          ? 'bg-slate-900 border border-slate-300 dark:border-slate-700 shadow-inner' 
          : 'bg-white border border-amber-300 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)]'
      }`}
    >
      {/* Sliding Thumb */}
      <div 
        className={`absolute w-6 h-6 rounded-full flex items-center justify-center transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] shadow-sm ${
          theme === 'dark'
            ? 'left-1 bg-slate-800 shadow-indigo-500/20'
            : 'left-[38px] bg-amber-50 shadow-amber-500/20'
        }`}
      >
        {theme === 'dark' ? (
          <Moon className="w-3.5 h-3.5 text-indigo-400" />
        ) : (
          <Sun className="w-3.5 h-3.5 text-amber-500" />
        )}
      </div>

      {/* Inactive Icons Background */}
      <div className="w-full flex justify-between px-2.5 pointer-events-none">
        <Moon className={`w-3.5 h-3.5 transition-all duration-300 ${theme === 'dark' ? 'opacity-0 scale-50' : 'opacity-40 text-slate-600 dark:text-slate-400 dark:text-slate-400 scale-100'}`} />
        <Sun className={`w-3.5 h-3.5 transition-all duration-300 ${theme === 'light' ? 'opacity-0 scale-50' : 'opacity-40 text-slate-600 dark:text-slate-400 dark:text-slate-400 scale-100'}`} />
      </div>
    </button>
  );
};

export const AdminHeader = () => {
  const { admin, logoutAdmin } = useAdminAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    logoutAdmin();
    navigate("/admin/login");
  };

  const getPageInfo = () => {
    const path = location.pathname;
    if (path.includes("/admin/dashboard")) return { title: "Dashboard Overview", desc: "Monitor your platform metrics and recent activities." };
    if (path.includes("/admin/node-health")) return { title: "Execution Node Health", desc: "Real-time status & latency across all 5 monitoring regions." };
    if (path.includes("/admin/boomerr-incidents")) return { title: "Platform Incidents Management", desc: "Manage public platform incidents displayed on boomerr.ai/status." };
    if (path.includes("/admin/users")) return { title: "Users Management", desc: "Manage and monitor user accounts and workspaces." };
    if (path.includes("/admin/email/templates")) return { title: "Email Templates", desc: "Manage and customize visual email templates." };
    if (path.includes("/admin/email/sequence")) return { title: "Email Sequences & Automations", desc: "Configure automated user onboarding, churn, and lifecycle campaigns." };
    if (path.includes("/admin/admins") && path.split("/").length > 3) return { title: "Admin Details", desc: "View and manage admin permissions and activity." };
    if (path.includes("/admin/admins")) return { title: "Super Admins", desc: "Manage administrative access to the platform." };
    if (path.includes("/admin/billing")) return { title: "Billing & Subscriptions", desc: "Monitor platform revenue and active subscriptions." };
    if (path.includes("/admin/logs")) return { title: "System Logs", desc: "Monitor system activities and error events." };
    if (path.includes("/admin/settings")) return { title: "Platform Settings", desc: "Manage global configuration and integrations." };
    if (path.includes("/admin/status-page")) return { title: "Public Status Page", desc: "Live preview of the public-facing status page." };
    if (path.includes("/admin/features")) return { title: "Feature Announcements", desc: "Manage and announce upcoming roadmap features and live updates." };
    return { title: "", desc: "" };
  };

  const { title, desc } = getPageInfo();

  return (
    <header className="bg-slate-50 dark:bg-[#050505]/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-8 py-6 sticky top-0 z-40">
      <div className="flex flex-col justify-center gap-1.5 py-1">
        {title && <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight leading-none">{title}</h1>}
        {desc && <p className="text-[13px] text-slate-600 dark:text-slate-400 dark:text-slate-400 leading-none">{desc}</p>}
      </div>

      <div className="flex items-center gap-6">
        <AdminThemeToggle />
        
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity focus:outline-none"
          >
            <div className="text-right">
              <p className="text-sm font-medium text-slate-900 dark:text-white">{admin?.name}</p>
              <p className="text-xs text-slate-600 dark:text-slate-400 dark:text-slate-400">Super Admin</p>
            </div>
            <div className="w-9 h-9 bg-gradient-to-tr from-blue-600 to-blue-400 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/20">
              <span className="text-white font-medium text-sm">
                {admin?.name?.charAt(0) || "A"}
              </span>
            </div>
          </button>

          {/* Dropdown Menu */}
          {dropdownOpen && (
            <div className="absolute right-0 mt-3 w-48 bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl py-2 z-50">
              <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800/60 mb-1">
                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{admin?.name}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 dark:text-slate-400 truncate">{admin?.email}</p>
              </div>

              <button
                onClick={() => {
                  setDropdownOpen(false);
                  navigate(`/admin/admins/${admin?.id}`);
                }}
                className="w-full text-left px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white flex items-center gap-2 transition-colors"
              >
                <User className="w-4 h-4" />
                My Profile
              </button>

              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-sm text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 transition-colors mt-1"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
