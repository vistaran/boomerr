import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Link2,
    Unlink2,
    CheckCircle2,
    AlertCircle,
    Save,
    Loader2,
    ChevronsLeftIcon,
    Plus,
    X,
    Building2,
    Layers,
    Folder,
    ListTodo,
    User2,
    Flag,
    ShieldAlert,
    ShieldX,
    Sparkles,
    ChevronRight,
    Tag
} from "lucide-react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import {
    getClickUpStatus,
    getClickUpConnectUrl,
    disconnectClickUp,
    getClickUpHierarchy,
    addNotificationChannel
} from "../../services/integrations-service";
import type { DomainIntegration } from "../../types/domain-integrations";
import ConfirmModal from "../common/confirm-modal";
import { ClickUpTreeExplorer, CLICKUP_QUERY_CACHE_OPTIONS, type ClickUpSelection } from "./clickup-tree-explorer";
import ClickupIcon from "../../assets/clickup-icon.svg";

type Props = {
    domainId: string | null;
    domainName: string;
    domainStatus: string;
    canManage?: boolean;
    setSelectedProvider: (provider: DomainIntegration | null) => void;
    integrationUlid: string;
    fetchWebhooks?: () => Promise<void>;
    webhooksCount?: number;
};

export function ClickUpInlinePanel({
    domainId,
    domainName,
    domainStatus: _domainStatus,
    canManage = true,
    setSelectedProvider,
    integrationUlid,
    fetchWebhooks,
    webhooksCount = 0
}: Props) {
    const queryClient = useQueryClient();
    const [connecting, setConnecting] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);
    const [showDisconnectModal, setShowDisconnectModal] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);

    // Form state
    const [name, setName] = useState(`ClickUp Tasks for ${domainName}`);
    const [events, setEvents] = useState<string[]>(['Domain Down', 'Domain Recovered']);
    const [selectedWorkspace, setSelectedWorkspace] = useState("");
    const [selectedSpace, setSelectedSpace] = useState("");
    const [selectedFolder, setSelectedFolder] = useState("");
    const [selectedList, setSelectedList] = useState("");
    const [workspaceName, setWorkspaceName] = useState("");
    const [spaceName, setSpaceName] = useState("");
    const [folderName, setFolderName] = useState("");
    const [listName, setListName] = useState("");
    const [selectedAssignee, setSelectedAssignee] = useState("");
    const [selectedPriority, setSelectedPriority] = useState("2");
    const [saving, setSaving] = useState(false);

    const handleTreeSelect = (sel: ClickUpSelection) => {
        setSelectedWorkspace(sel.workspaceId);
        setWorkspaceName(sel.workspaceName);
        setSelectedSpace(sel.spaceId);
        setSpaceName(sel.spaceName);
        setSelectedFolder(sel.folderId);
        setFolderName(sel.folderName);
        setSelectedList(sel.listId);
        setListName(sel.listName);
        setSelectedAssignee("");
    };

    const handleWorkspaceChange = (wsId: string, wsName: string) => {
        setSelectedWorkspace(wsId);
        setWorkspaceName(wsName);
        setSelectedSpace("");
        setSpaceName("");
        setSelectedFolder("");
        setFolderName("");
        setSelectedList("");
        setListName("");
        setSelectedAssignee("");
    };

    // Fetch ClickUp connection status (cached for 5 min)
    const { data: statusData, isLoading: statusLoading, refetch: refetchStatus } = useQuery({
        queryKey: ["clickupStatus"],
        queryFn: getClickUpStatus,
        staleTime: 1000 * 60 * 5,
    });

    const isConnected = !!statusData?.connected;

    // Fetch workspaces ONLY when Add Modal is open, using 30-min cache
    const { data: workspaces } = useQuery({
        queryKey: ["clickupWorkspaces"],
        queryFn: () => getClickUpHierarchy("workspaces"),
        enabled: isConnected && showAddModal,
        ...CLICKUP_QUERY_CACHE_OPTIONS
    });

    // Auto-select single workspace if available
    useEffect(() => {
        if (workspaces && workspaces.length === 1 && !selectedWorkspace) {
            setSelectedWorkspace(String(workspaces[0].id));
            if (!workspaceName) {
                setWorkspaceName(workspaces[0].name);
            }
        }
    }, [workspaces, selectedWorkspace, workspaceName]);

    // Fetch members for assignee selection ONLY when list is chosen and modal is open
    const { data: members, isLoading: membersLoading } = useQuery({
        queryKey: ["clickupMembers", selectedList],
        queryFn: () => getClickUpHierarchy("members", { list_id: selectedList }),
        enabled: isConnected && !!selectedList && showAddModal,
        ...CLICKUP_QUERY_CACHE_OPTIONS
    });

    // Handle Escape key to close modal
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && showAddModal && !saving) {
                setShowAddModal(false);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [showAddModal, saving]);

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (showAddModal) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [showAddModal]);

    const handleConnect = async () => {
        try {
            setConnecting(true);
            const url = await getClickUpConnectUrl();
            window.location.href = url;
        } catch (error) {
            toast.error("Failed to initiate ClickUp connection");
            setConnecting(false);
        }
    };

    const handleDisconnect = async () => {
        try {
            setDisconnecting(true);
            await disconnectClickUp();
            await refetchStatus();
            toast.success("Disconnected ClickUp successfully");
            setShowDisconnectModal(false);
        } catch (error) {
            toast.error("Failed to disconnect ClickUp");
        } finally {
            setDisconnecting(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedList || !domainId) return;

        setSaving(true);
        try {
            await addNotificationChannel({
                name,
                url: "clickup://api",
                integration_ulid: integrationUlid,
                domain_id: domainId,
                events,
                meta_json: {
                    clickup_workspace_id: selectedWorkspace,
                    clickup_space_id: selectedSpace,
                    clickup_folder_id: selectedFolder,
                    clickup_list_id: selectedList,
                    default_assignee: selectedAssignee,
                    default_priority: parseInt(selectedPriority)
                }
            });

            toast.success("ClickUp integration configured successfully!");
            queryClient.invalidateQueries({ queryKey: ["domainIntegrations"] });
            if (fetchWebhooks) {
                await fetchWebhooks();
            }
            setShowAddModal(false);
            // Reset fields
            setSelectedList("");
            setSelectedAssignee("");
        } catch (error) {
            toast.error("Failed to configure ClickUp integration");
        } finally {
            setSaving(false);
        }
    };

    const toggleEvent = (evt: string) => {
        setEvents(prev => prev.includes(evt) ? prev.filter(e => e !== evt) : [...prev, evt]);
    };

    // Derived hierarchy names for live breadcrumb
    const currentWorkspaceName = workspaces?.find((w: any) => String(w.id) === String(selectedWorkspace))?.name || workspaceName;
    const currentSpaceName = spaceName;
    const currentFolderName = folderName;
    const currentListName = listName;

    if (statusLoading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => setSelectedProvider(null)}
                        className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200 transition !outline-none"
                    >
                        <ChevronsLeftIcon className="w-4 h-4" />
                        Back to Integrations
                    </button>
                </div>
                <div className="flex justify-center p-12">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in w-full max-w-full min-w-0">
            {/* Header Navigation */}
            <div className="flex items-center justify-between w-full max-w-full min-w-0">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                    <button
                        type="button"
                        onClick={() => setSelectedProvider(null)}
                        className="inline-flex items-center gap-1 text-xs sm:text-sm text-slate-400 hover:text-slate-200 transition !outline-none flex-shrink-0"
                    >
                        <ChevronsLeftIcon className="w-4 h-4" />
                        Back to Integrations
                    </button>

                    <span className="text-slate-600 flex-shrink-0">/</span>

                    <div className="flex items-center gap-2 truncate">
                        <div className="p-1 rounded-md bg-indigo-500/10 flex-shrink-0 flex items-center justify-center">
                            <img src={ClickupIcon} alt="ClickUp" className="w-4 h-4" />
                        </div>
                        <h2 className="text-base sm:text-lg font-semibold text-slate-100 truncate">
                            ClickUp
                        </h2>
                    </div>
                </div>

                {/* Primary Add Integration Button in Header */}
                {isConnected && canManage && (
                    <div className="flex-shrink-0">
                        <button
                            type="button"
                            onClick={() => setShowAddModal(true)}
                            className="group inline-flex items-center gap-1.5 sm:gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/40 hover:scale-105 transition-all duration-200"
                        >
                            <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-200" />
                            <span>Add Integration</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Connection Status Card */}
            <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 p-4 sm:p-6 flex flex-col md:flex-row gap-4 sm:gap-6 justify-between items-start md:items-center w-full max-w-full min-w-0 shadow-lg backdrop-blur-sm">
                <div className="flex items-center gap-4">
                    <div className={`pl-3 py-2 pr-2 rounded-xl shadow-lg flex-shrink-0 flex items-center justify-center ${isConnected
                        ? 'bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/40'
                        : 'bg-slate-800/60 border border-slate-700/60'
                        }`}>
                        <img src={ClickupIcon} alt="ClickUp" className="w-7 h-7" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-base sm:text-lg font-bold text-white">
                                {isConnected ? "ClickUp is Connected" : "Connect to ClickUp"}
                            </h3>
                            {isConnected && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    Active
                                </span>
                            )}
                        </div>
                        <p className="text-xs sm:text-sm text-slate-400 mt-1">
                            {isConnected
                                ? `Authenticated as ${statusData?.user?.username || statusData?.user?.email || 'User'}`
                                : "Link your account to automatically create tasks in ClickUp for incidents."}
                        </p>
                    </div>
                </div>

                {canManage && (
                    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                        {isConnected ? (
                            <button
                                type="button"
                                onClick={() => setShowDisconnectModal(true)}
                                disabled={disconnecting}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 sm:px-3.5 py-2 text-xs sm:text-sm font-medium text-red-400 hover:bg-red-500/20 transition-colors"
                            >
                                <Unlink2 className="w-4 h-4" />
                                Disconnect
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleConnect}
                                disabled={connecting}
                                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/20 transition-all hover:scale-105"
                            >
                                {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                                Connect Account
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Empty State when Connected but No Integrations Added Yet */}
            {isConnected && webhooksCount === 0 && (
                <div className="rounded-2xl border-2 border-dashed border-slate-800 bg-slate-900/30 p-8 sm:p-12 text-center animate-fade-in backdrop-blur-sm">
                    <div className="mx-auto w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4 shadow-inner">
                        <img src={ClickupIcon} alt="ClickUp" className="w-8 h-8" />
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-white mb-1.5">
                        No ClickUp Task Automations Configured
                    </h3>
                </div>
            )}

            {/* ================= Add Integration Popup Modal ================= */}
            {showAddModal && isConnected && createPortal(
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
                        onClick={() => !saving && setShowAddModal(false)}
                    />

                    {/* Modal Dialog */}
                    <div className="relative z-10 w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden animate-scale-up">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-900/95 backdrop-blur-md flex-shrink-0">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="p-1.5 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/40 flex-shrink-0 flex items-center justify-center">
                                    <img src={ClickupIcon} alt="ClickUp" className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-sm sm:text-base font-bold text-white truncate">
                                        Add ClickUp Integration
                                    </h3>
                                    <p className="text-[11px] text-slate-400 truncate">
                                        Automate task creation for {domainName}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => !saving && setShowAddModal(false)}
                                className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex-shrink-0"
                                aria-label="Close"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Modal Scrollable Body */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-5 space-y-3.5">
                            <form id="clickup-add-form" onSubmit={handleSave} className="space-y-3.5">
                                {/* Live Hierarchy Breadcrumb Trail */}
                                <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/25 text-xs">
                                    <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-x-auto text-slate-200 custom-scrollbar">
                                        <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider flex-shrink-0 flex items-center gap-1">
                                            <Sparkles className="w-3 h-3 text-indigo-400" /> Path:
                                        </span>
                                        <span className="truncate text-white font-medium">
                                            {workspaceName || currentWorkspaceName || <span className="text-slate-300 italic">Workspace</span>}
                                        </span>
                                        <ChevronRight className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                        <span className="truncate text-white font-medium">
                                            {spaceName || currentSpaceName || <span className="text-slate-300 italic">Space</span>}
                                        </span>
                                        <ChevronRight className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                        <span className="truncate text-slate-200 font-medium">
                                            {folderName || currentFolderName || <span className="text-slate-300 italic">Folder</span>}
                                        </span>
                                        <ChevronRight className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                        <span className={`truncate font-semibold ${selectedList ? 'text-emerald-300' : 'text-slate-300 italic'}`}>
                                            {listName || currentListName || 'Target List'}
                                        </span>
                                    </div>
                                    {selectedList ? (
                                        <span className="flex-shrink-0 inline-flex items-center gap-1 text-[11px] font-medium text-emerald-300 bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 rounded-full">
                                            <CheckCircle2 className="w-3 h-3" /> Ready
                                        </span>
                                    ) : (
                                        <span className="flex-shrink-0 text-[11px] text-slate-300 hidden sm:inline">
                                            Click any list below to select
                                        </span>
                                    )}
                                </div>

                                {/* ClickUp Hierarchy Explorer (Tree View with Search) */}
                                <ClickUpTreeExplorer
                                    selectedWorkspace={selectedWorkspace}
                                    selectedSpace={selectedSpace}
                                    selectedFolder={selectedFolder}
                                    selectedList={selectedList}
                                    onSelect={handleTreeSelect}
                                    onWorkspaceChange={handleWorkspaceChange}
                                    canManage={canManage}
                                />

                                {/* Task Defaults (Single 3-Column Row) */}
                                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 sm:p-3.5 space-y-2.5">
                                    <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-1.5 pb-1.5 border-b border-slate-800/80">
                                        <Flag className="w-3.5 h-3.5 text-indigo-400" />
                                        Task Settings
                                    </h4>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                        {/* Integration Name */}
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                                                <Tag className="w-3.5 h-3.5 text-indigo-400" />
                                                Integration Name
                                            </label>
                                            <input
                                                type="text"
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                disabled={!canManage}
                                                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 sm:py-2 text-xs text-white placeholder-slate-400 outline-none focus:border-indigo-500 transition-colors"
                                                placeholder="e.g. ClickUp Tasks"
                                                required
                                            />
                                        </div>

                                        {/* Default Assignee */}
                                        <div className="space-y-1">
                                            <div className="flex items-center justify-between">
                                                <label className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                                                    <User2 className="w-3.5 h-3.5 text-sky-400" />
                                                    Assignee <span className="text-[10px] text-slate-400 font-normal">(Optional)</span>
                                                </label>
                                                {membersLoading && <Loader2 className="w-3 h-3 animate-spin text-sky-400" />}
                                            </div>
                                            <select
                                                value={selectedAssignee}
                                                onChange={(e) => setSelectedAssignee(e.target.value)}
                                                disabled={!selectedList || !canManage || membersLoading}
                                                style={{ colorScheme: 'dark' }}
                                                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 sm:py-2 text-xs text-slate-100 outline-none focus:border-indigo-500 transition-colors disabled:opacity-50 [&>option]:bg-slate-900 [&>option]:text-slate-100"
                                            >
                                                <option value="" className="bg-slate-900 text-slate-100">
                                                    {selectedList ? "Unassigned" : "Select list first"}
                                                </option>
                                                {members?.map((m: any) => {
                                                    const id = m.user?.id || m.id;
                                                    const username = m.user?.username || m.username;
                                                    if (!id) return null;
                                                    return <option key={id} value={id} className="bg-slate-900 text-slate-100">{username}</option>;
                                                })}
                                            </select>
                                        </div>

                                        {/* Priority Dropdown */}
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                                                <Flag className="w-3.5 h-3.5 text-amber-400" />
                                                Task Priority
                                            </label>
                                            <select
                                                value={selectedPriority}
                                                onChange={(e) => setSelectedPriority(e.target.value)}
                                                disabled={!canManage}
                                                style={{ colorScheme: 'dark' }}
                                                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 sm:py-2 text-xs text-slate-100 outline-none focus:border-indigo-500 transition-colors disabled:opacity-50 [&>option]:bg-slate-900 [&>option]:text-slate-100"
                                            >
                                                <option value="1" className="bg-slate-900 text-slate-100">🔴 Urgent</option>
                                                <option value="2" className="bg-slate-900 text-slate-100">🟠 High</option>
                                                <option value="3" className="bg-slate-900 text-slate-100">🔵 Normal</option>
                                                <option value="4" className="bg-slate-900 text-slate-100">⚪ Low</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Trigger Events (Compact 4-Column Row) */}
                                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 sm:p-3.5 space-y-2">
                                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/80">
                                        <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                                            <AlertCircle className="w-3.5 h-3.5 text-indigo-400" />
                                            Trigger Events
                                        </h4>
                                        <span className="text-[11px] text-slate-300 font-medium">
                                            {events.length} of 4 selected
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                        {[
                                            { id: 'Domain Down', label: 'Domain Down', color: 'rose', icon: AlertCircle },
                                            { id: 'Domain Recovered', label: 'Domain Recovered', color: 'emerald', icon: CheckCircle2 },
                                            { id: 'SSL Expiring', label: 'SSL Expiring', color: 'amber', icon: ShieldAlert },
                                            { id: 'SSL Expired', label: 'SSL Expired', color: 'rose', icon: ShieldX },
                                        ].map(({ id, label, color, icon: Icon }) => {
                                            const active = events.includes(id);
                                            return (
                                                <button
                                                    type="button"
                                                    key={id}
                                                    onClick={() => canManage && toggleEvent(id)}
                                                    disabled={!canManage}
                                                    className={`flex items-center justify-between gap-1.5 px-2.5 py-1.5 sm:py-2 rounded-lg border text-xs font-medium transition-all ${active
                                                        ? color === 'rose'
                                                            ? 'bg-rose-500/20 border-rose-500/70 text-rose-100 ring-1 ring-rose-500/30'
                                                            : color === 'emerald'
                                                                ? 'bg-emerald-500/20 border-emerald-500/70 text-emerald-100 ring-1 ring-emerald-500/30'
                                                                : 'bg-amber-500/20 border-amber-500/70 text-amber-100 ring-1 ring-amber-500/30'
                                                        : 'bg-slate-900 border-slate-750 text-slate-200 hover:border-slate-600 hover:text-white'
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-1.5 truncate">
                                                        <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${active ? (color === 'rose' ? 'text-rose-300' : color === 'emerald' ? 'text-emerald-300' : 'text-amber-300') : 'text-slate-400'
                                                            }`} />
                                                        <span className="truncate">{label}</span>
                                                    </div>
                                                    <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center text-[9px] flex-shrink-0 ${active ? 'bg-indigo-500 border-indigo-400 text-white font-bold' : 'border-slate-700 bg-slate-950'
                                                        }`}>
                                                        {active && '✓'}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </form>
                        </div>

                        {/* Modal Fixed Footer */}
                        <div className="flex items-center justify-end gap-2.5 px-5 py-3 border-t border-slate-800 bg-slate-900/95 backdrop-blur-md flex-shrink-0">
                            <button
                                type="button"
                                onClick={() => setShowAddModal(false)}
                                disabled={saving}
                                className="px-3.5 py-1.5 text-xs sm:text-sm font-medium text-slate-300 hover:text-white transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                form="clickup-add-form"
                                disabled={!selectedList || saving || !canManage}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {saving ? (
                                    <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        <span>Configuring...</span>
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-3.5 h-3.5" />
                                        <span>Create Integration</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Disconnect Confirmation Modal */}
            <ConfirmModal
                open={showDisconnectModal}
                onCancel={() => setShowDisconnectModal(false)}
                onConfirm={handleDisconnect}
                title="Disconnect ClickUp"
                description="Are you sure you want to disconnect ClickUp? Boomerr will no longer be able to create tasks for incidents."
                confirmLabel="Disconnect"
                tone="danger"
                confirming={disconnecting}
            />
        </div>
    );
}
