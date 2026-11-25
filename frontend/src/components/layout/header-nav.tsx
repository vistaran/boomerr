import type { WorkspaceSummary } from "../../services/api-service";
import Logo from '../../assets/logo-5.png'
import { Menu, ChevronDown, RotateCw, Check, Plus, Building2, Bell, User2Icon, AlertCircle, User as UserIcon, LifeBuoy, LogOut } from "lucide-react";
import { useState, useRef, useEffect, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getNotifications, markAllNotificationsRead, markNotificationRead, type AppNotification } from "../../services/notification-service";
import { getPlans } from "../../services/billing-service";
import { queryKeys } from "../../api";
import NotificationListItem from "./notification-list-item";
import { Link } from "react-router-dom";
import type { User } from "../../types/user";
import { useRuntimeConfig } from "../../hooks/use-runtime-config";

type HeaderNavProps = {
    user: User;
    workspaces: WorkspaceSummary[];
    onWorkspaceSwitch: (workspaceId: string) => Promise<boolean> | boolean;
    switchingWorkspaceId: string | null;
    onWorkspaceCreate: (name: string) => Promise<boolean> | boolean;
    isCreatingWorkspace: boolean;
    onLogout: () => void;
    onSidebarToggle?: () => void;
};

export function HeaderNav({ user, workspaces, onWorkspaceSwitch, switchingWorkspaceId, onWorkspaceCreate, isCreatingWorkspace, onLogout, onSidebarToggle }: HeaderNavProps) {
    const [userDropdownOpen, setUserDropdownOpen] = useState(false);
    const [workspaceDropdownOpen, setWorkspaceDropdownOpen] = useState(false);
    const [newWorkspaceName, setNewWorkspaceName] = useState("");
    const [workspaceNameError, setWorkspaceNameError] = useState<string | null>(null);
    const userDropdownRef = useRef<HTMLDivElement>(null);
    const workspaceDropdownRef = useRef<HTMLDivElement>(null);
    const [isNotifOpen, setIsNotifOpen] = useState(false);
    const notifRef = useRef<HTMLDivElement>(null);
    const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
    const { billingEnabled } = useRuntimeConfig();

    const queryClient = useQueryClient();
    const currentWorkspace = workspaces.find((ws) => ws.is_current);
    const currentWorkspaceId = currentWorkspace?.ulid ?? user.workspace_ulid ?? currentWorkspace?.id ?? user.workspace_id ?? null;
    const notificationListKey = queryKeys.notifications.list(currentWorkspaceId ?? undefined);
    const unreadCountKey = queryKeys.notifications.unreadCount(currentWorkspaceId ?? undefined);

    const { data } = useQuery({
        queryKey: notificationListKey,
        queryFn: () => getNotifications(undefined, undefined, currentWorkspaceId ?? undefined)
    });
    const notifications = data?.data ?? [];
    const unreadCount = data?.unread_count ?? 0;

    const markRead = async (id: string) => {
        await markNotificationRead(id);
        queryClient.setQueryData(notificationListKey, (prev: any) => {
            const list = (prev?.data ?? []) as AppNotification[];
            return {
                ...prev,
                data: list.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
                unread_count: Math.max(0, (prev?.unread_count ?? 1) - 1),
            };
        });

        // Keep unread count in sync
        queryClient.setQueryData(unreadCountKey, (prev: any) => {
            const n = typeof prev === 'number' ? prev : 0;
            return Math.max(0, n - 1);
        });
    };

    const markAllRead = async () => {
        await markAllNotificationsRead(currentWorkspaceId ?? undefined);
        queryClient.setQueryData(notificationListKey, (prev: any) => {
            const list = (prev?.data ?? []) as AppNotification[];
            return {
                ...prev,
                data: list.map((n) => ({ ...n, read_at: new Date().toISOString() })),
                unread_count: 0,
            };
        });

        // Reset unread count
        queryClient.setQueryData(unreadCountKey, 0);

        // Invalidate other notification queries for freshness
        queryClient.invalidateQueries({ queryKey: notificationListKey });
    };

    const workspaceDisplayName = currentWorkspace?.name ?? (user.workspace_ulid ? `Workspace ${user.workspace_ulid}` : "Select workspace");

    // Fetch subscription status
    useEffect(() => {
        const fetchSubscriptionStatus = async () => {
            try {
                const data = await getPlans();
                setSubscriptionStatus(data?.status ?? null);
            } catch (error) {
                console.error('Failed to fetch subscription status:', error);
                setSubscriptionStatus(null);
            }
        };

        if (billingEnabled && currentWorkspaceId) {
            fetchSubscriptionStatus();
        }
    }, [currentWorkspaceId]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
                setUserDropdownOpen(false);
            }
        }
        if (userDropdownOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        } else {
            document.removeEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [userDropdownOpen]);

    useEffect(() => {
        function handleWorkspaceClickOutside(event: MouseEvent) {
            if (workspaceDropdownRef.current && !workspaceDropdownRef.current.contains(event.target as Node)) {
                setWorkspaceDropdownOpen(false);
            }
        }
        if (workspaceDropdownOpen) {
            document.addEventListener("mousedown", handleWorkspaceClickOutside);
        } else {
            document.removeEventListener("mousedown", handleWorkspaceClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleWorkspaceClickOutside);
        };
    }, [workspaceDropdownOpen]);

    // Close notifications popover when clicking outside
    useEffect(() => {
        function handleNotifClickOutside(event: MouseEvent) {
            if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
                setIsNotifOpen(false);
            }
        }
        if (isNotifOpen) {
            document.addEventListener("mousedown", handleNotifClickOutside);
        } else {
            document.removeEventListener("mousedown", handleNotifClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleNotifClickOutside);
        };
    }, [isNotifOpen]);

    const handleWorkspaceSelect = async (workspaceId: string) => {
        if (workspaces.find((ws) => ws.ulid === workspaceId)?.is_current) {
            return;
        }
        const switched = await onWorkspaceSwitch(workspaceId);
        if (switched) {
            setWorkspaceDropdownOpen(false);
        }
    };



    const handleWorkspaceCreate = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!newWorkspaceName.trim()) {
            setWorkspaceNameError("Workspace name is required.");
            return;
        }
        setWorkspaceNameError(null);
        const created = await onWorkspaceCreate(newWorkspaceName.trim());
        if (created) {
            setNewWorkspaceName("");
            setWorkspaceNameError(null);
            setWorkspaceDropdownOpen(false);
        }
    };

    return (
        <>
            <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur">
                <div className="mx-auto flex h-14 items-center justify-between gap-1 px-2 sm:px-4 md:h-16 md:px-6 lg:px-8">
                    <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                        {/* Sidebar toggle for mobile */}
                        <button
                            className="flex-shrink-0 h-11 w-11 sm:h-10 sm:w-10 flex items-center justify-center rounded-lg bg-slate-900 border border-slate-800 shadow-lg sm:hidden hover:bg-slate-800 hover:border-slate-700 transition-colors"
                            onClick={onSidebarToggle}
                            aria-label="Open sidebar"
                        >
                            <Menu size={24} className="sm:hidden" />
                            <Menu size={20} className="hidden sm:block" />
                        </button>
                        <div className="flex-shrink-0 h-10 w-10 sm:h-12 sm:w-12 flex items-center justify-center">
                            <img src={Logo} alt="Boomerr Logo" className="h-9 w-9 sm:h-11 sm:w-11" />
                        </div>
                        <div className="flex flex-col gap-0 hidden xs:flex min-w-0">
                            <span className="text-xs sm:text-sm font-semibold tracking-tight text-slate-50 truncate">
                                Boomerr
                            </span>
                            <span className="text-xs uppercase tracking-[0.16em] text-slate-400 truncate">
                                Uptime Watch
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                        <div className="" ref={workspaceDropdownRef}>
                            <button
                                className="relative flex-shrink-0 flex items-center justify-center sm:justify-start h-11 w-11 sm:h-auto sm:w-auto gap-1 sm:gap-2 rounded-lg sm:rounded-2xl border border-slate-800/80 bg-slate-900/60 px-0 sm:px-3 py-0 sm:py-1 shadow-lg hover:border-slate-700 transition-colors"
                                onClick={() => setWorkspaceDropdownOpen((open) => !open)}
                                aria-haspopup="true"
                                aria-expanded={workspaceDropdownOpen}
                                title={workspaceDisplayName}
                            >
                                <div className="flex-shrink-0 h-7 w-7 sm:h-8 sm:w-8 flex items-center justify-center rounded-lg bg-slate-800/80 text-slate-200">
                                    <Building2 size={20} className="sm:hidden" />
                                    <Building2 size={18} className="hidden sm:block" />
                                </div>
                                <div className="hidden sm:flex flex-col min-w-0">
                                    <span className="text-[9px] sm:text-[10px] tracking-[0.32em] text-slate-200">Workspace</span>
                                    <span className="text-xs sm:text-sm font-semibold text-slate-100 max-w-[120px] sm:max-w-[180px] truncate">
                                        {workspaceDisplayName}
                                    </span>
                                </div>
                                <ChevronDown size={16} className="text-slate-400 flex-shrink-0 hidden sm:block" />
                            </button>
                            {workspaceDropdownOpen && (
                                <div className="absolute top-14 left-2 right-2 sm:right-0 sm:left-auto sm:top-auto sm:mt-2 max-h-[calc(100vh-80px)] sm:max-h-96 sm:w-96 rounded-lg sm:rounded-2xl border border-slate-700/80 bg-slate-900 shadow-2xl backdrop-blur-xl z-50 flex flex-col">
                                    <div className="border-b border-slate-800/80 px-3 py-2 sticky top-0 bg-slate-900 flex-shrink-0 rounded-t-lg sm:rounded-t-2xl">
                                        <div className="text-xs sm:text-sm tracking-[0.32em] text-slate-200">Your workspaces</div>
                                    </div>
                                    <div className="overflow-y-auto flex-1 min-h-0 px-3 sm:px-0 py-2 sm:py-0">
                                        {workspaces.length ? (
                                            workspaces.map((workspace) => (
                                                <button
                                                    key={workspace.ulid}
                                                    className={`w-full px-0 sm:px-3 py-2 sm:py-3 text-left transition-colors rounded-lg sm:rounded-none min-h-[44px] ${workspace.is_current ? "bg-slate-800" : "hover:bg-slate-800"}`}
                                                    onClick={() => handleWorkspaceSelect(workspace.ulid)}
                                                    disabled={switchingWorkspaceId === workspace.ulid}
                                                >
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="text-sm font-semibold text-slate-100 truncate flex-1">{workspace.name}</span>
                                                        <div className="flex items-center gap-1 text-xs uppercase tracking-wide flex-shrink-0">
                                                            {switchingWorkspaceId === workspace.ulid ? (
                                                                <RotateCw size={14} className="animate-spin text-slate-400" />
                                                            ) : workspace.is_current ? (
                                                                <Check size={16} className="text-emerald-400" />
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                    <span className="text-xs text-slate-400 capitalize">Role: {workspace.role}</span>
                                                </button>
                                            ))
                                        ) : (
                                            <div className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-slate-400">
                                                <RotateCw size={16} className="animate-spin flex-shrink-0" />
                                                <span>Fetching your workspaces…</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="border-t border-slate-800/80 px-3 sm:px-4 py-2 sm:py-3 bg-slate-900 flex-shrink-0 sticky bottom-0 rounded-b-lg sm:rounded-b-2xl">
                                        <form onSubmit={handleWorkspaceCreate} className="space-y-2" noValidate>
                                            <label className="text-xs sm:text-sm font-semibold tracking-wide text-slate-300">Create new workspace <span className="text-red-500">*</span></label>
                                            <div className="flex flex-col gap-2">
                                                <input
                                                    type="text"
                                                    value={newWorkspaceName}
                                                    onChange={(e) => {
                                                        setNewWorkspaceName(e.target.value);
                                                        if (e.target.value.trim()) setWorkspaceNameError(null);
                                                    }}
                                                    className={`w-full rounded-lg border min-h-[44px] ${workspaceNameError ? 'border-red-500' : 'border-slate-800'} bg-slate-900 px-3 py-2 text-xs sm:text-sm text-slate-100 placeholder:text-slate-400 focus:border-slate-600 focus:outline-none`}
                                                    placeholder="Workspace name"
                                                />
                                                <button
                                                    type="submit"
                                                    className="inline-flex items-center justify-center gap-1 rounded-lg bg-sky-500 px-3 py-2 text-xs sm:text-sm font-semibold text-slate-950 transition-colors hover:bg-sky-400 disabled:opacity-60 min-h-[44px] w-full"
                                                    disabled={isCreatingWorkspace}
                                                >
                                                    {isCreatingWorkspace ? (
                                                        <RotateCw size={16} className="animate-spin" />
                                                    ) : (
                                                        <Plus size={16} />
                                                    )}
                                                    <span>{isCreatingWorkspace ? "Creating" : "Create"}</span>
                                                </button>
                                            </div>
                                            {workspaceNameError && (
                                                <p className="text-xs text-red-500 mt-1">{workspaceNameError}</p>
                                            )}
                                        </form>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="relative" ref={userDropdownRef}>
                            <button
                                className="relative flex-shrink-0 flex items-center justify-center sm:justify-start h-11 w-11 sm:h-auto sm:w-auto gap-1 sm:gap-2 rounded-lg sm:rounded-2xl border border-slate-800/80 bg-slate-900/60 px-0 sm:px-3 py-0 sm:py-1 text-xs sm:text-sm font-medium text-slate-300 hover:bg-slate-800/90 hover:border-slate-700 hover:text-slate-100 transition-colors shadow-lg min-h-[40px]"
                                onClick={() => setUserDropdownOpen((open) => !open)}
                                aria-haspopup="true"
                                aria-expanded={userDropdownOpen}
                            >
                                <User2Icon size={20} className="sm:hidden" />
                                <User2Icon size={18} className="hidden sm:block flex-shrink-0" />
                                <span className="hidden sm:inline max-w-[120px] truncate">{user.name}</span>
                                <ChevronDown size={16} className="text-slate-400 hidden sm:block flex-shrink-0" />
                            </button>
                            {userDropdownOpen && (
                                <div className="absolute right-0 mt-2 min-w-[220px] sm:min-w-[240px] rounded-xl bg-slate-900 border border-slate-800 shadow-2xl z-50 animate-fade-in overflow-hidden">
                                    <Link
                                        to="/settings"
                                        onClick={() => setUserDropdownOpen(false)}
                                        className="px-3.5 sm:px-4 py-2.5 sm:py-3 border-b border-slate-800/80 flex items-center gap-3 hover:bg-slate-800/60 transition-colors group"
                                        title="Profile & Settings"
                                    >
                                        <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700/80 flex items-center justify-center flex-shrink-0 text-slate-300 group-hover:text-white group-hover:border-slate-600 transition-colors">
                                            <UserIcon size={16} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="font-semibold text-xs sm:text-sm text-slate-100 truncate group-hover:text-sky-400 transition-colors">{user.name}</div>
                                            <div className="text-xs text-slate-400 truncate">{user.email}</div>
                                        </div>
                                    </Link>
                                    <Link
                                        to="/support"
                                        onClick={() => setUserDropdownOpen(false)}
                                        className="w-full text-left px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-slate-300 hover:bg-slate-800/60 hover:text-white transition-colors min-h-[42px] flex items-center gap-2.5 border-b border-slate-800/60 group"
                                    >
                                        <LifeBuoy size={16} className="text-slate-400 group-hover:text-sky-400 flex-shrink-0 transition-colors" />
                                        <span className="font-medium">Support</span>
                                    </Link>
                                    <button
                                        onClick={() => {
                                            setUserDropdownOpen(false);
                                            onLogout();
                                        }}
                                        className="w-full text-left px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-slate-300 hover:bg-red-500/10 hover:text-red-400 transition-colors rounded-b-xl min-h-[42px] flex items-center gap-2.5 group"
                                    >
                                        <LogOut size={16} className="text-slate-400 group-hover:text-red-400 flex-shrink-0 transition-colors" />
                                        <span className="font-medium">Logout</span>
                                    </button>
                                </div>
                            )}
                        </div>
                        {/* Hide bell icon on /notifications route */}
                        {window.location.pathname !== "/notifications" && (
                            <div className="" ref={notifRef}>
                                <button
                                    className="relative flex-shrink-0 flex items-center justify-center sm:justify-start h-11 w-11 sm:h-auto sm:w-auto gap-1 sm:gap-2 rounded-lg sm:rounded-2xl border border-slate-800/80 bg-slate-900/60 px-0 sm:px-3 py-0 sm:py-1 text-slate-200 hover:bg-slate-800/90 hover:border-slate-700 transition-colors shadow-lg min-h-[40px]"
                                    onClick={() => setIsNotifOpen((o) => !o)}
                                    aria-haspopup="true"
                                    aria-expanded={isNotifOpen}
                                    aria-label="Notifications"
                                >
                                    <Bell size={20} className="sm:hidden" />
                                    <div className="hidden sm:flex items-center gap-2 min-w-0">
                                        <Bell size={18} className="flex-shrink-0" />
                                        {/* <span className="text-xs sm:text-sm font-semibold text-slate-100 truncate">Notifications</span> */}
                                    </div>
                                    {unreadCount > 0 && (
                                        <span className="absolute -top-1 -right-2 min-w-[22px] h-5 px-1.5 rounded-full bg-red-500 text-[10px] sm:text-[9px] font-bold text-white flex items-center justify-center">
                                            {Math.min(unreadCount, 99)}{unreadCount > 99 ? '+' : ''}
                                        </span>
                                    )}
                                </button>

                                {isNotifOpen && (
                                    <div className="absolute top-16 left-2 right-2 sm:right-0 sm:left-auto sm:top-auto sm:mt-2 max-h-[calc(100vh-80px)] sm:max-h-80 sm:w-96 rounded-lg sm:rounded-2xl border border-slate-700/80 bg-slate-900/95 shadow-2xl backdrop-blur-xl z-50 flex flex-col">
                                        <div className="flex items-center justify-between border-b border-slate-700/80 px-3 sm:px-4 py-2 sm:py-3 sticky top-0 bg-slate-900/95 gap-2 rounded-t-lg sm:rounded-t-2xl">
                                            <div className="text-xs uppercase tracking-[0.32em] text-slate-200 flex-1">Notifications</div>
                                            <div className="flex items-center gap-1 flex-shrink-0">
                                                <Link
                                                    to="/notifications"
                                                    className="inline-flex items-center rounded-lg border border-slate-700 bg-slate-800 px-2 sm:px-3 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-slate-100 transition-colors whitespace-nowrap"
                                                    onClick={() => setIsNotifOpen(false)}
                                                >
                                                    View all
                                                </Link>
                                                <button
                                                    className="inline-flex items-center rounded-lg border border-slate-700 bg-slate-800 px-2 sm:px-3 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-sky-400 transition-colors !outline-none whitespace-nowrap"
                                                    onClick={markAllRead}
                                                >
                                                    Read all
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex-1 overflow-y-auto custom-scrollbar px-3 sm:px-0">
                                            {notifications.length === 0 ? (
                                                <div className="px-1 sm:px-3 py-6 text-xs sm:text-sm text-slate-400 text-center">No notifications yet</div>
                                            ) : (
                                                notifications.map((n) => (
                                                    <NotificationListItem key={n.id} n={n} onMarkRead={() => markRead(n.id)} />
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </header>
            {billingEnabled && ['past_due', 'pending', 'halted'].includes(subscriptionStatus ?? '') && (
                <div className="sticky top-14 md:top-16 z-20 bg-red-500/50 border-b border-red-500/20 px-2 sm:px-4 md:px-6 lg:px-8 py-2 sm:py-3">
                    <div className="max-w-6xl mx-auto flex items-start gap-2 sm:gap-3">
                        <AlertCircle size={18} className="text-red-200 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 text-xs sm:text-sm min-w-0">
                            <p className="text-red-200 font-medium">Payment failed</p>
                            <p className="text-red-200 mt-1">Your payment is overdue. <Link to="/billing" className="underline hover:text-red-100 font-semibold">Go to billing</Link> to {subscriptionStatus === 'halted' ? 'subscribe again' : 'retry payment'} or your features will be limited.</p>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
