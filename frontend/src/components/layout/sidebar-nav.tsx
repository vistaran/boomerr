import type { ReactNode } from "react";
import { useState } from "react";
import { NavLink } from "react-router-dom";
import { Settings, ChevronLeft, ChevronRight, ScrollText, CloudAlertIcon, Globe, ShieldCheck, Banknote, Users, LayoutDashboard, Wrench } from "lucide-react";
import { Tooltip } from "../common/tooltip";
import { useAuth } from "../../context/auth-context";
import { useRuntimeConfig } from "../../hooks/use-runtime-config";

type SidebarNavProps = {
    collapsed?: boolean;
    onCollapseToggle?: () => void;
    onSidebarToggle?: () => void;
};

type NavItem = {
    to: string;
    label: string;
    icon: ReactNode;
    badge?: string;
};

const NAV_ITEMS: NavItem[] = [
    { to: "/dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
    { to: "/overview", label: "Domains", icon: <Globe size={18} /> },
    { to: "/ssl-monitoring", label: "SSL Monitoring", icon: <ShieldCheck size={18} /> },
    { to: "/incidents", label: "Incidents", icon: <CloudAlertIcon size={18} /> },
    { to: "/status-pages", label: "Status Pages", icon: <Globe size={18} /> },
    { to: "/departments", label: "Departments", icon: <Users size={18} /> },
    { to: "/tools", label: "Tools", icon: <Wrench size={18} /> },
    { to: "/logs", label: "Logs", icon: <ScrollText size={18} /> },
    { to: "/billing", label: "Billing", icon: <Banknote size={18} /> },
    { to: "/settings", label: "Settings", icon: <Settings size={18} /> },
];

const SIDEBAR_COLLAPSE_KEY = "sidebar:collapsed";

export function SidebarNav({ collapsed: collapsedProp, onCollapseToggle, onSidebarToggle }: SidebarNavProps) {
    const { workspaces } = useAuth();
    const [internalCollapsed, setInternalCollapsed] = useState<boolean>(() => {
        try {
            return localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === "true";
        } catch {
            return false;
        }
    });

    const currentWorkspace = workspaces.find((workspace) => workspace.is_current) ?? null;
    const { billingEnabled } = useRuntimeConfig();
    let navItems = currentWorkspace?.role === "owner"
        ? NAV_ITEMS
        : NAV_ITEMS.filter((item) => item.to !== "/billing");

    if (!billingEnabled) {
        navItems = navItems.filter((item) => item.to !== "/billing");
    }

    const collapsed = collapsedProp ?? internalCollapsed;

    const handleToggle = () => {
        if (onCollapseToggle) {
            onCollapseToggle();
        } else {
            setInternalCollapsed(prev => {
                const next = !prev;
                try {
                    localStorage.setItem(SIDEBAR_COLLAPSE_KEY, String(next));
                } catch {
                    //
                }
                return next;
            });
        }
    };


    // The header is 56px (h-14) on mobile, 64px (h-16) on md+, so we add top padding accordingly
    // Use pt-14 for mobile, pt-16 for md+
    return (
        <aside
            className={`flex relative h-full transition-all duration-300 bg-gradient-to-b from-slate-950/95 to-slate-900/95 border-r border-slate-800/50 pb-2 pt-2 backdrop-blur-sm flex-col z-10
                ${collapsed ? "w-[56px] min-w-[56px] max-w-[56px]" : "w-full sm:w-[220px] max-w-[220px] min-w-[56px]"}
            `}
            style={{ minWidth: collapsed ? 56 : undefined }}
        >

            <button
                type="button"
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                onClick={handleToggle}
                className="
                    absolute top-[50%] -right-3.5 z-30
                    hidden sm:flex h-7 w-7 items-center justify-center
                    rounded-full
                    bg-slate-800
                    border border-slate-700
                    text-slate-300
                    shadow-md
                    hover:bg-slate-700
                    hover:text-slate-100
                    transition-all"
            >
                {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
            <nav className={`flex-1 flex flex-col gap-1 sm:gap-1.5 text-xs sm:text-sm mt-3 transition-all duration-300 ${collapsed ? "items-center px-1.5 sm:px-0" : "px-2 sm:px-3"}`}>
                {navItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={onSidebarToggle}
                        data-tour={`tour-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                        className={({ isActive }) =>
                            `group flex items-center ${collapsed ? "justify-center" : "gap-2 sm:gap-3"} rounded-lg ${collapsed ? "px-1.5" : "px-2 sm:px-3 py-2.5 w-full min-h-[44px] sm:min-h-[auto]"} transition-all duration-200 ease-out ` +
                            (isActive
                                ? "bg-gradient-to-r from-sky-500/20 to-indigo-500/20 text-sky-400 shadow-lg shadow-sky-500/10 ring-1 ring-sky-500/30"
                                : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 hover:shadow-md hover:ring-1 hover:ring-slate-700/50 hover:scale-105 active:scale-95 transition-transform")
                        }
                    >
                        {({ isActive }: { isActive: boolean }) => (
                            <>
                                {collapsed ? (
                                    <Tooltip label={item.label} side="right">
                                        <span
                                            className={
                                                "flex-shrink-0 transition-transform duration-200 flex items-center justify-center w-10 h-10 " +
                                                (isActive
                                                    ? "text-sky-400"
                                                    : "text-slate-500 group-hover:text-sky-400 group-hover:scale-110")
                                            }
                                        >
                                            {item.icon}
                                        </span>
                                    </Tooltip>
                                ) : (
                                    <>
                                        <span
                                            className={
                                                "flex-shrink-0 transition-transform duration-200 flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 " +
                                                (isActive
                                                    ? "text-sky-400"
                                                    : "text-slate-500 group-hover:text-sky-400 group-hover:scale-110")
                                            }
                                        >
                                            {item.icon}
                                        </span>
                                        <span className="truncate text-xs sm:text-sm font-medium ml-1 sm:ml-2">
                                            {item.label}
                                        </span>
                                        {item.badge && (
                                            <span className="ml-auto rounded-full bg-sky-500/20 px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-sky-400 ring-1 ring-sky-500/30 flex-shrink-0">
                                                {item.badge}
                                            </span>
                                        )}
                                    </>
                                )}
                            </>
                        )}
                    </NavLink>
                ))}
            </nav>
        </aside>
    );
}
