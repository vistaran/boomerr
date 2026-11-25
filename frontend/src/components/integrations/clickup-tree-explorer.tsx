import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Building2,
    Layers,
    Folder,
    FolderOpen,
    ListTodo,
    ChevronRight,
    ChevronDown,
    Check,
    Search,
    Loader2,
    X,
    FolderTree,
    Sparkles,
    RotateCcw
} from "lucide-react";
import { getClickUpHierarchy, clearClickUpHierarchyCache } from "../../services/integrations-service";

export const CLICKUP_QUERY_CACHE_OPTIONS = {
    staleTime: 1000 * 60 * 30, // 30 minutes in-memory cache
    gcTime: 1000 * 60 * 60,    // 1 hour garbage collection
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
};

export interface ClickUpSelection {
    workspaceId: string;
    workspaceName: string;
    spaceId: string;
    spaceName: string;
    folderId: string;
    folderName: string;
    listId: string;
    listName: string;
}

interface ClickUpTreeExplorerProps {
    selectedWorkspace?: string;
    selectedSpace?: string;
    selectedFolder?: string;
    selectedList: string;
    onSelect: (selection: ClickUpSelection) => void;
    onWorkspaceChange?: (workspaceId: string, workspaceName: string) => void;
    canManage?: boolean;
}

// Subcomponent: Folder Node in the tree
function FolderNode({
    folder,
    spaceId,
    spaceName,
    workspaceId,
    workspaceName,
    selectedList,
    onSelectList,
    searchQuery,
    canManage
}: {
    folder: any;
    spaceId: string;
    spaceName: string;
    workspaceId: string;
    workspaceName: string;
    selectedList: string;
    onSelectList: (item: ClickUpSelection) => void;
    searchQuery: string;
    canManage: boolean;
}) {
    // If folder contains selected list or matches search, default expanded
    const folderContainsSelected = useMemo(() => {
        if (!selectedList) return false;
        if (folder.lists && Array.isArray(folder.lists)) {
            return folder.lists.some((l: any) => String(l.id) === String(selectedList));
        }
        return false;
    }, [folder, selectedList]);

    const [isExpanded, setIsExpanded] = useState<boolean>(() => folderContainsSelected || searchQuery.length > 0);

    useEffect(() => {
        if (folderContainsSelected || searchQuery.length > 0) {
            setIsExpanded(true);
        }
    }, [folderContainsSelected, searchQuery]);

    // Fallback query if folder.lists wasn't populated in getFolders
    const hasEmbeddedLists = Array.isArray(folder.lists) && folder.lists.length > 0;
    const { data: fetchedLists, isLoading: listsLoading } = useQuery({
        queryKey: ["clickupFolderLists", spaceId, folder.id],
        queryFn: () => getClickUpHierarchy("lists", { space_id: spaceId, folder_id: folder.id }),
        enabled: isExpanded && !hasEmbeddedLists,
        ...CLICKUP_QUERY_CACHE_OPTIONS
    });

    const lists = hasEmbeddedLists ? folder.lists : (fetchedLists || []);

    const filteredLists = useMemo(() => {
        if (!searchQuery) return lists;
        const q = searchQuery.toLowerCase();
        return lists.filter((l: any) =>
            l.name?.toLowerCase().includes(q) || folder.name?.toLowerCase().includes(q)
        );
    }, [lists, searchQuery, folder.name]);

    if (searchQuery && filteredLists.length === 0 && !folder.name?.toLowerCase().includes(searchQuery.toLowerCase())) {
        return null;
    }

    return (
        <div className="space-y-0.5">
            {/* Folder Header Row */}
            <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between gap-1.5 px-2 py-1.5 rounded-lg text-xs hover:bg-slate-800/80 text-slate-200 hover:text-white transition-colors group text-left"
            >
                <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-slate-400 group-hover:text-slate-200 flex-shrink-0">
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </span>
                    {isExpanded ? (
                        <FolderOpen className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                    ) : (
                        <Folder className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                    )}
                    <span className="font-medium truncate text-slate-100">{folder.name}</span>
                </div>
                <span className="text-[10px] text-slate-300 font-mono flex-shrink-0 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700/60">
                    {lists.length} {lists.length === 1 ? 'list' : 'lists'}
                </span>
            </button>

            {/* Folder Children (Lists) */}
            {isExpanded && (
                <div className="pl-5 space-y-0.5 border-l border-slate-700/80 ml-3.5 my-0.5">
                    {listsLoading && !hasEmbeddedLists ? (
                        <div className="flex items-center gap-1.5 py-1 px-2 text-[11px] text-slate-300">
                            <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                            Loading lists...
                        </div>
                    ) : filteredLists.length === 0 ? (
                        <div className="py-1 px-2 text-[11px] text-slate-300 italic">No lists in this folder</div>
                    ) : (
                        filteredLists.map((list: any) => {
                            const isSelected = String(list.id) === String(selectedList);
                            return (
                                <button
                                    type="button"
                                    key={list.id}
                                    onClick={() => {
                                        if (canManage) {
                                            onSelectList({
                                                workspaceId,
                                                workspaceName,
                                                spaceId,
                                                spaceName,
                                                folderId: folder.id,
                                                folderName: folder.name,
                                                listId: list.id,
                                                listName: list.name
                                            });
                                        }
                                    }}
                                    disabled={!canManage}
                                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-all text-left group ${isSelected
                                        ? "bg-emerald-950/50 border border-emerald-500/70 text-white ring-1 ring-emerald-500/30 font-semibold shadow-sm"
                                        : "hover:bg-slate-800/80 text-slate-100 hover:text-white border border-transparent"
                                        }`}
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <ListTodo
                                            className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? "text-emerald-400" : "text-slate-300 group-hover:text-emerald-400"
                                                }`}
                                        />
                                        <span className={`truncate ${isSelected ? "text-white font-semibold" : "text-slate-100"}`}>{list.name}</span>
                                    </div>
                                    {isSelected ? (
                                        <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-emerald-200 bg-emerald-500/25 border border-emerald-400/40 px-1.5 py-0.5 rounded">
                                            <Check className="w-3 h-3" /> Target
                                        </span>
                                    ) : (
                                        <span className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                            Select
                                        </span>
                                    )}
                                </button>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
}

// Subcomponent: Space Node in the tree
function SpaceNode({
    space,
    workspaceId,
    workspaceName,
    selectedList,
    onSelectList,
    searchQuery,
    canManage,
    defaultExpanded
}: {
    space: any;
    workspaceId: string;
    workspaceName: string;
    selectedList: string;
    onSelectList: (item: ClickUpSelection) => void;
    searchQuery: string;
    canManage: boolean;
    defaultExpanded: boolean;
}) {
    const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded || searchQuery.length > 0);

    useEffect(() => {
        if (searchQuery.length > 0) {
            setIsExpanded(true);
        }
    }, [searchQuery]);

    // Fetch folders for this space
    const { data: folders, isLoading: foldersLoading } = useQuery({
        queryKey: ["clickupFolders", space.id],
        queryFn: () => getClickUpHierarchy("folders", { space_id: space.id }),
        enabled: isExpanded,
        ...CLICKUP_QUERY_CACHE_OPTIONS
    });

    // Fetch folderless lists for this space
    const { data: spaceLists, isLoading: spaceListsLoading } = useQuery({
        queryKey: ["clickupSpaceLists", space.id],
        queryFn: () => getClickUpHierarchy("lists", { space_id: space.id }),
        enabled: isExpanded,
        ...CLICKUP_QUERY_CACHE_OPTIONS
    });

    const isLoading = foldersLoading || spaceListsLoading;

    const filteredSpaceLists = useMemo(() => {
        if (!spaceLists) return [];
        if (!searchQuery) return spaceLists;
        const q = searchQuery.toLowerCase();
        return spaceLists.filter((l: any) =>
            l.name?.toLowerCase().includes(q) || space.name?.toLowerCase().includes(q)
        );
    }, [spaceLists, searchQuery, space.name]);

    return (
        <div className="space-y-0.5">
            {/* Space Row */}
            <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg text-xs hover:bg-slate-800/80 text-slate-100 hover:text-white transition-colors group text-left"
            >
                <div className="flex items-center gap-2 min-w-0">
                    <span className="text-slate-400 group-hover:text-slate-200 flex-shrink-0">
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </span>
                    <div className="w-4 h-4 rounded bg-purple-500/25 text-purple-300 border border-purple-400/50 flex items-center justify-center flex-shrink-0">
                        <Layers className="w-2.5 h-2.5" />
                    </div>
                    <span className="font-semibold truncate text-white">{space.name}</span>
                </div>
                {isLoading ? (
                    <Loader2 className="w-3 h-3 animate-spin text-purple-400 flex-shrink-0" />
                ) : (
                    <span className="text-[10px] text-slate-300 font-mono flex-shrink-0 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700/60">
                        {(folders?.length || 0) + (spaceLists?.length || 0)} items
                    </span>
                )}
            </button>

            {/* Space Children */}
            {isExpanded && (
                <div className="pl-4 space-y-1 border-l border-slate-700/80 ml-4 my-1">
                    {isLoading ? (
                        <div className="flex items-center gap-1.5 py-2 px-2 text-xs text-slate-300">
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
                            Loading space contents...
                        </div>
                    ) : (
                        <>
                            {/* Folders in space */}
                            {folders?.map((folder: any) => (
                                <FolderNode
                                    key={folder.id}
                                    folder={folder}
                                    spaceId={space.id}
                                    spaceName={space.name}
                                    workspaceId={workspaceId}
                                    workspaceName={workspaceName}
                                    selectedList={selectedList}
                                    onSelectList={onSelectList}
                                    searchQuery={searchQuery}
                                    canManage={canManage}
                                />
                            ))}

                            {/* Folderless lists directly under space */}
                            {filteredSpaceLists.map((list: any) => {
                                const isSelected = String(list.id) === String(selectedList);
                                return (
                                    <button
                                        type="button"
                                        key={list.id}
                                        onClick={() => {
                                            if (canManage) {
                                                onSelectList({
                                                    workspaceId,
                                                    workspaceName,
                                                    spaceId: space.id,
                                                    spaceName: space.name,
                                                    folderId: "",
                                                    folderName: "Space Level (No Folder)",
                                                    listId: list.id,
                                                    listName: list.name
                                                });
                                            }
                                        }}
                                        disabled={!canManage}
                                        className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-all text-left group ${isSelected
                                            ? "bg-emerald-950/50 border border-emerald-500/70 text-white ring-1 ring-emerald-500/30 font-semibold shadow-sm"
                                            : "hover:bg-slate-800/80 text-slate-100 hover:text-white border border-transparent"
                                            }`}
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <ListTodo
                                                className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? "text-emerald-400" : "text-slate-300 group-hover:text-emerald-400"
                                                    }`}
                                            />
                                            <span className={`truncate ${isSelected ? "text-white font-semibold" : "text-slate-100"}`}>{list.name}</span>
                                            <span className="text-[9px] uppercase font-semibold text-slate-300 bg-slate-800 border border-slate-700/60 px-1 py-0.5 rounded">
                                                Space Level
                                            </span>
                                        </div>
                                        {isSelected ? (
                                            <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-emerald-200 bg-emerald-500/25 border border-emerald-400/40 px-1.5 py-0.5 rounded">
                                                <Check className="w-3 h-3" /> Target
                                            </span>
                                        ) : (
                                            <span className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                                Select
                                            </span>
                                        )}
                                    </button>
                                );
                            })}

                            {(!folders || folders.length === 0) && filteredSpaceLists.length === 0 && (
                                <div className="py-2 px-2 text-xs text-slate-300 italic">
                                    No folders or lists found in this space.
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

export function ClickUpTreeExplorer({
    selectedWorkspace,
    selectedList,
    onSelect,
    onWorkspaceChange,
    canManage = true
}: ClickUpTreeExplorerProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(selectedWorkspace || "");
    const [isRefreshing, setIsRefreshing] = useState(false);
    const queryClient = useQueryClient();

    // Track external changes to selectedWorkspace prop so internal clicks are not overridden
    const prevPropWorkspaceRef = useRef<string | undefined>(selectedWorkspace);
    useEffect(() => {
        if (selectedWorkspace && selectedWorkspace !== prevPropWorkspaceRef.current) {
            prevPropWorkspaceRef.current = selectedWorkspace;
            setActiveWorkspaceId(selectedWorkspace);
        }
    }, [selectedWorkspace]);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        clearClickUpHierarchyCache();
        await queryClient.invalidateQueries({ queryKey: ["clickupWorkspaces"] });
        await queryClient.invalidateQueries({ queryKey: ["clickupSpaces"] });
        await queryClient.invalidateQueries({ queryKey: ["clickupFolders"] });
        await queryClient.invalidateQueries({ queryKey: ["clickupSpaceLists"] });
        await queryClient.invalidateQueries({ queryKey: ["clickupFolderLists"] });
        setTimeout(() => setIsRefreshing(false), 500);
    };

    // Fetch workspaces (cached for 30 min, avoiding refetch on page load or window focus)
    const { data: workspaces, isLoading: workspacesLoading } = useQuery({
        queryKey: ["clickupWorkspaces"],
        queryFn: () => getClickUpHierarchy("workspaces"),
        ...CLICKUP_QUERY_CACHE_OPTIONS
    });

    // Auto-select first workspace on initial load if none selected
    useEffect(() => {
        if (!activeWorkspaceId && workspaces && workspaces.length > 0) {
            const firstId = String(workspaces[0].id);
            const firstName = workspaces[0].name;
            setActiveWorkspaceId(firstId);
            prevPropWorkspaceRef.current = firstId;
            onWorkspaceChange?.(firstId, firstName);
        }
    }, [workspaces, activeWorkspaceId, onWorkspaceChange]);

    // Handle user switching workspace tab
    const handleWorkspaceTabClick = (wsId: string, wsName: string) => {
        if (wsId === activeWorkspaceId) return;
        setActiveWorkspaceId(wsId);
        prevPropWorkspaceRef.current = wsId;
        onWorkspaceChange?.(wsId, wsName);
    };

    // Active workspace details
    const activeWorkspace = useMemo(() => {
        return workspaces?.find((w: any) => String(w.id) === String(activeWorkspaceId)) || workspaces?.[0];
    }, [workspaces, activeWorkspaceId]);

    // Fetch spaces for the active workspace
    const { data: spaces, isLoading: spacesLoading } = useQuery({
        queryKey: ["clickupSpaces", activeWorkspaceId],
        queryFn: () => getClickUpHierarchy("spaces", { team_id: activeWorkspaceId }),
        enabled: !!activeWorkspaceId,
        ...CLICKUP_QUERY_CACHE_OPTIONS
    });

    return (
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden flex flex-col">
            {/* Top Toolbar: Search & Workspace Tabs */}
            <div className="p-2.5 border-b border-slate-800/80 bg-slate-900/60 space-y-2">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-white uppercase tracking-wider">
                        <FolderTree className="w-3.5 h-3.5 text-indigo-400" />
                        <span>ClickUp Hierarchy Explorer</span>
                        <button
                            type="button"
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            title="Refresh ClickUp hierarchy"
                            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-0.5"
                        >
                            <RotateCcw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
                        </button>
                    </div>
                    <span className="text-[11px] text-slate-200 flex items-center gap-1 font-medium">
                        <Sparkles className="w-3 h-3 text-indigo-400" />
                        Click any list to select
                    </span>
                </div>

                {/* Workspace Selector Tabs (if multiple workspaces exist) */}
                {workspaces && workspaces.length > 1 && (
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 custom-scrollbar">
                        {workspaces.map((w: any) => {
                            const isActive = String(w.id) === String(activeWorkspaceId);
                            return (
                                <button
                                    type="button"
                                    key={w.id}
                                    onClick={() => handleWorkspaceTabClick(String(w.id), w.name)}
                                    className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap ${isActive
                                        ? "bg-indigo-600/40 text-white border border-indigo-400 font-semibold shadow-sm"
                                        : "bg-slate-800 text-slate-100 hover:text-white border border-slate-700 hover:bg-slate-700"
                                        }`}
                                >
                                    <Building2 className={`w-3 h-3 ${isActive ? 'text-indigo-300' : 'text-slate-300'}`} />
                                    <span>{w.name}</span>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Search Input Filter */}
                <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-300 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search spaces, folders, or lists..."
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 pl-8 pr-7 py-1.5 text-xs text-slate-100 placeholder-slate-400 outline-none focus:border-indigo-500 transition-colors"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery("")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-white"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Tree Content Area (Scrollable with fixed max-height) */}
            <div className="h-56 max-h-56 overflow-y-auto custom-scrollbar p-2 space-y-1">
                {workspacesLoading || spacesLoading ? (
                    <div className="flex flex-col items-center justify-center h-full py-8 text-slate-300 text-xs gap-2">
                        <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                        <span>Loading ClickUp structure...</span>
                    </div>
                ) : !spaces || spaces.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full py-8 text-slate-400 text-xs">
                        <Layers className="w-6 h-6 text-slate-500 mb-1" />
                        <span>No spaces found in this workspace</span>
                    </div>
                ) : (
                    spaces.map((space: any, idx: number) => (
                        <SpaceNode
                            key={space.id}
                            space={space}
                            workspaceId={String(activeWorkspace?.id || activeWorkspaceId)}
                            workspaceName={activeWorkspace?.name || "Workspace"}
                            selectedList={selectedList}
                            onSelectList={onSelect}
                            searchQuery={searchQuery}
                            canManage={canManage}
                            defaultExpanded={spaces.length === 1 || idx === 0 || !!selectedList}
                        />
                    ))
                )}
            </div>
        </div>
    );
}
