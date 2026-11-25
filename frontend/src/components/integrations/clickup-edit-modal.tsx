import { useEffect, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
    CheckCircle2,
    Save,
    Loader2,
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
    AlertCircle
} from "lucide-react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import {
    updateNotificationChannel,
    getClickUpHierarchy
} from "../../services/integrations-service";
import type { DomainIntegration } from "../../types/domain-integrations";
import { ClickUpTreeExplorer, CLICKUP_QUERY_CACHE_OPTIONS, type ClickUpSelection } from "./clickup-tree-explorer";
import ClickupIcon from "../../assets/clickup-icon.svg";

type ClickUpEditModalProps = {
    open: boolean;
    provider: DomainIntegration;
    webhook: any | null;
    onClose: () => void;
    onUpdated: () => void;
    canManage: boolean;
};

export function ClickUpEditModal({
    open,
    provider: _provider,
    webhook,
    onClose,
    onUpdated,
    canManage
}: ClickUpEditModalProps) {
    const queryClient = useQueryClient();
    const fetchedRef = useRef<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [initialLoadDone, setInitialLoadDone] = useState(false);

    // Form state
    const [events, setEvents] = useState<string[]>(() => webhook?.events || ['Domain Down', 'Domain Recovered']);
    const [selectedWorkspace, setSelectedWorkspace] = useState(() => webhook?.meta_json?.clickup_workspace_id || "");
    const [selectedSpace, setSelectedSpace] = useState(() => webhook?.meta_json?.clickup_space_id || "");
    const [selectedFolder, setSelectedFolder] = useState(() => webhook?.meta_json?.clickup_folder_id || "");
    const [selectedList, setSelectedList] = useState(() => webhook?.meta_json?.clickup_list_id || "");
    const [workspaceName, setWorkspaceName] = useState("");
    const [spaceName, setSpaceName] = useState("");
    const [folderName, setFolderName] = useState("");
    const [listName, setListName] = useState("");
    const [selectedAssignee, setSelectedAssignee] = useState(() => webhook?.meta_json?.default_assignee || "");
    const [selectedPriority, setSelectedPriority] = useState(() => String(webhook?.meta_json?.default_priority || "2"));

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

    // Reset when webhook changes
    useEffect(() => {
        if (webhook && webhook.ulid !== fetchedRef.current) {
            fetchedRef.current = webhook.ulid;
            setEvents(webhook.events || ['Domain Down', 'Domain Recovered']);
            setSelectedWorkspace(webhook.meta_json?.clickup_workspace_id || "");
            setSelectedSpace(webhook.meta_json?.clickup_space_id || "");
            setSelectedFolder(webhook.meta_json?.clickup_folder_id || "");
            setSelectedList(webhook.meta_json?.clickup_list_id || "");
            setSelectedAssignee(webhook.meta_json?.default_assignee || "");
            setSelectedPriority(String(webhook.meta_json?.default_priority || "2"));
            setInitialLoadDone(false);
        }
    }, [webhook]);

    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onClose();
            }
        };

        document.addEventListener("keydown", handleEscape);
        return () => {
            document.removeEventListener("keydown", handleEscape);
        };
    }, [onClose, open]);

    // Fetch hierarchy data
    const isConnected = true; // since it's already created
    const { data: workspaces, isFetching: workspacesFetching } = useQuery({
        queryKey: ["clickupWorkspaces"],
        queryFn: () => getClickUpHierarchy("workspaces"),
        enabled: isConnected && open,
        ...CLICKUP_QUERY_CACHE_OPTIONS
    });

    const { data: spaces, isFetching: spacesFetching } = useQuery({
        queryKey: ["clickupSpaces", selectedWorkspace],
        queryFn: () => getClickUpHierarchy("spaces", { team_id: selectedWorkspace }),
        enabled: isConnected && !!selectedWorkspace && open,
        ...CLICKUP_QUERY_CACHE_OPTIONS
    });

    const { data: folders, isFetching: foldersFetching } = useQuery({
        queryKey: ["clickupFolders", selectedSpace],
        queryFn: () => getClickUpHierarchy("folders", { space_id: selectedSpace }),
        enabled: isConnected && !!selectedSpace && open,
        ...CLICKUP_QUERY_CACHE_OPTIONS
    });

    const { data: lists, isFetching: listsFetching } = useQuery({
        queryKey: ["clickupLists", selectedSpace, selectedFolder],
        queryFn: () => getClickUpHierarchy("lists", {
            space_id: selectedSpace,
            folder_id: selectedFolder
        }),
        enabled: isConnected && !!selectedSpace && open,
        ...CLICKUP_QUERY_CACHE_OPTIONS
    });

    const { data: members, isFetching: membersFetching } = useQuery({
        queryKey: ["clickupMembers", selectedList],
        queryFn: () => getClickUpHierarchy("members", { list_id: selectedList }),
        enabled: isConnected && !!selectedList && open,
        ...CLICKUP_QUERY_CACHE_OPTIONS
    });

    useEffect(() => {
        if (!open || initialLoadDone) return;

        const isAnyFetching = workspacesFetching || spacesFetching || foldersFetching || listsFetching || membersFetching;
        if (!isAnyFetching) {
            setInitialLoadDone(true);
        }
    }, [
        open, initialLoadDone, workspacesFetching,
        spacesFetching, foldersFetching, listsFetching, membersFetching
    ]);

    if (!open || !webhook) return null;

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedList) return;

        setSaving(true);
        try {
            const webhookId = String(webhook.ulid ?? webhook.id);
            await updateNotificationChannel(webhookId, {
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

            toast.success("ClickUp configuration updated successfully!");
            queryClient.invalidateQueries({ queryKey: ["domainIntegrations"] });
            onUpdated();
        } catch (error) {
            toast.error("Failed to update ClickUp configuration");
        } finally {
            setSaving(false);
        }
    };

    const toggleEvent = (evt: string) => {
        setEvents(prev => prev.includes(evt) ? prev.filter(e => e !== evt) : [...prev, evt]);
    };

    // Derived names for live breadcrumb path
    const currentWorkspaceName = workspaces?.find((w: any) => String(w.id) === String(selectedWorkspace))?.name;
    const currentSpaceName = spaces?.find((s: any) => String(s.id) === String(selectedSpace))?.name;
    const currentFolderName = selectedFolder
        ? folders?.find((f: any) => String(f.id) === String(selectedFolder))?.name
        : (selectedSpace ? "Space Level (No Folder)" : "");
    const currentListName = lists?.find((l: any) => String(l.id) === String(selectedList))?.name;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
                onClick={() => !saving && onClose()}
            />

            {/* Modal */}
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
                                Edit ClickUp Configuration
                            </h3>
                            <p className="text-[11px] text-slate-400 truncate">
                                {webhook?.name || "Update task destination and defaults"}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => !saving && onClose()}
                        className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex-shrink-0"
                        aria-label="Close"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {!initialLoadDone ? (
                    <div className="flex flex-col items-center justify-center py-16">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-4" />
                        <p className="text-slate-300 font-medium text-sm">Fetching ClickUp hierarchy details...</p>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-5 space-y-3.5">
                        <form id="clickup-edit-form" onSubmit={handleSave} className="space-y-3.5">
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
                                {selectedList && (
                                    <span className="flex-shrink-0 inline-flex items-center gap-1 text-[11px] font-medium text-emerald-300 bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 rounded-full">
                                        <CheckCircle2 className="w-3 h-3" /> Ready
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

                            {/* Task Defaults (2-Column Grid) */}
                            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 sm:p-3.5 space-y-2.5">
                                <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-1.5 pb-1.5 border-b border-slate-800/80">
                                    <Flag className="w-3.5 h-3.5 text-indigo-400" />
                                    Task Settings
                                </h4>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    {/* Default Assignee */}
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                                                <User2 className="w-3.5 h-3.5 text-sky-400" />
                                                Assignee <span className="text-[10px] text-slate-400 font-normal">(Optional)</span>
                                            </label>
                                            {membersFetching && <Loader2 className="w-3 h-3 animate-spin text-sky-400" />}
                                        </div>
                                        <select
                                            value={selectedAssignee}
                                            onChange={(e) => setSelectedAssignee(e.target.value)}
                                            disabled={!selectedList || !canManage || membersFetching}
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
                )}

                {/* Modal Fixed Footer */}
                <div className="flex items-center justify-end gap-2.5 px-5 py-3 border-t border-slate-800 bg-slate-900/95 backdrop-blur-md flex-shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="px-3.5 py-1.5 text-xs sm:text-sm font-medium text-slate-300 hover:text-white transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="clickup-edit-form"
                        disabled={!selectedList || saving || !canManage}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? (
                            <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Saving...</span>
                            </>
                        ) : (
                            <>
                                <Save className="w-3.5 h-3.5" />
                                <span>Save Changes</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
