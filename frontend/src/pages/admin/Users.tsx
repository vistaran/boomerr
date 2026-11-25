import React, { useEffect, useState, lazy, Suspense } from "react";
import { adminApi } from "../../context/admin-auth-context";
import { Search, Mail, Building, Globe, ChevronDown, ChevronRight, Calendar } from "lucide-react";
import toast from "react-hot-toast";

const DomainDetailsPanel = lazy(() => import("../../components/domains/DomainDetailsPanel").then(m => ({ default: m.DomainDetailsPanel })));
const DomainList = lazy(() => import("../../components/domains/DomainList").then(m => ({ default: m.DomainList })));

export const AdminUsers = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<Set<string>>(new Set());
  const [activeDomainId, setActiveDomainId] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await adminApi.get("/api/admin/users");
      setUsers(response.data.data || []);
    } catch (err) {
      toast.error("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  const toggleUser = (userId: string) => {
    if (expandedUsers.has(userId)) {
      setExpandedUsers(new Set());
    } else {
      setExpandedUsers(new Set([userId]));
    }
  };

  const toggleWorkspace = (workspace: any) => {
    const wsKey = String(workspace.ulid || workspace.id);
    if (expandedWorkspaces.has(wsKey)) {
      setExpandedWorkspaces(new Set());
    } else {
      setExpandedWorkspaces(new Set([wsKey]));
      if (workspace.domains && workspace.domains.length > 0) {
        const firstDomain = workspace.domains[0];
        setActiveDomainId(String(firstDomain.ulid || firstDomain.id));
      }
    }
  };

  const filteredUsers = users.filter((user) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const nameMatch = user.name?.toLowerCase().includes(query);
    const emailMatch = user.email?.toLowerCase().includes(query);
    const workspaceMatch = user.workspaces?.some((ws: any) =>
      ws.name?.toLowerCase().includes(query) ||
      ws.domains?.some((d: any) => d.name?.toLowerCase().includes(query) || d.url?.toLowerCase().includes(query))
    );
    return nameMatch || emailMatch || workspaceMatch;
  });

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800/60 bg-white dark:bg-[#0a0a0a] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-slate-900 dark:text-white font-medium text-sm">All Users</h2>
            <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-400 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 font-mono">
              {filteredUsers.length}
            </span>
          </div>
          <div className="relative">
            <Search className="w-5 h-5 text-slate-600 dark:text-slate-400 dark:text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search users, emails, domains..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-blue-500 w-64 transition-colors"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-600 dark:text-slate-400 dark:text-slate-400 font-mono text-xs animate-pulse">Loading users...</div>
        ) : (
          <div>
            {filteredUsers.length === 0 ? (
              <div className="p-12 text-center text-slate-600 dark:text-slate-400 dark:text-slate-400">
                {searchQuery ? "No users match your search query." : "No users found."}
              </div>
            ) : (
              filteredUsers.map((user, index) => (
                <div
                  key={user.ulid}
                  className={`bg-transparent hover:bg-white/[0.02] p-4 sm:p-5 transition-colors ${index !== users.length - 1 ? 'border-b border-slate-200 dark:border-slate-800/60' : ''
                    }`}
                >

                  {/* Header */}
                  <div
                    className="flex items-center gap-3 cursor-pointer group"
                    onClick={() => toggleUser(user.ulid)}
                  >
                    {expandedUsers.has(user.ulid) ? (
                      <ChevronDown className="w-4 h-4 text-slate-600 dark:text-slate-400 dark:text-slate-400 group-hover:text-slate-900 dark:text-white transition-colors" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-400 dark:text-slate-400 group-hover:text-slate-900 dark:text-white transition-colors" />
                    )}
                    <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800/50 flex items-center justify-center border border-slate-200 dark:border-slate-700/50">
                      <span className="text-slate-700 dark:text-slate-300 font-medium text-xs">{user.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <h3 className="text-slate-900 dark:text-white font-medium text-[15px] tracking-wide">{user.name}</h3>
                  </div>

                  {expandedUsers.has(user.ulid) && (
                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800/40">
                      {/* Combined Inline Info Row */}
                      <div className="flex flex-wrap items-center gap-4">
                        {/* User Pills */}
                        <div className="flex items-center gap-2.5 bg-slate-100 dark:bg-[#0a0d14] px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-800/60 shadow-sm w-fit">
                          <Mail className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                          <span className="text-[13px] text-slate-700 dark:text-slate-300 font-medium">{user.email}</span>
                        </div>
                        <div className="flex items-center gap-2.5 bg-slate-100 dark:bg-[#0a0d14] px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-800/60 shadow-sm w-fit">
                          <Calendar className="w-4 h-4 text-purple-500 dark:text-purple-400" />
                          <span className="text-[13px] text-slate-700 dark:text-slate-300 font-medium">
                            Joined: {new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>

                        {/* Workspace Pills */}
                        {user.workspaces?.map((workspace: any) => {
                          const wsKey = String(workspace.ulid || workspace.id);
                          return (
                            <button
                              key={wsKey}
                              className="flex items-center gap-2 cursor-pointer group bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-all px-4 py-2 rounded-lg border border-blue-200 dark:border-blue-500/30 w-fit shadow-sm"
                              onClick={() => toggleWorkspace(workspace)}
                            >
                              <Building className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                              <span className="text-blue-700 dark:text-blue-100 font-medium text-[13px]">{workspace.name}</span>
                              <span className="text-[11px] font-semibold bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-md ml-1">
                                {workspace.domains?.length || 0} Domain{workspace.domains?.length !== 1 && 's'}
                              </span>
                              {expandedWorkspaces.has(wsKey) ? (
                                <ChevronDown className="w-4 h-4 text-blue-600 dark:text-blue-400 ml-1 opacity-70 group-hover:opacity-100 transition-opacity" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-blue-600 dark:text-blue-400 ml-1 opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Workspace Split Layouts */}
                      {user.workspaces?.map((workspace: any) => {
                        const wsKey = String(workspace.ulid || workspace.id);
                        if (!expandedWorkspaces.has(wsKey)) return null;

                        const hasDomains = workspace.domains && workspace.domains.length > 0;
                        const activeDomainInWorkspace = workspace.domains?.find(
                          (d: any) => String(d.id) === String(activeDomainId) || String(d.ulid) === String(activeDomainId)
                        ) || (workspace.domains && workspace.domains.length > 0 ? workspace.domains[0] : null);

                        if (!hasDomains) {
                          return (
                            <div key={`workspace-empty-${wsKey}`} className="mt-4 p-8 text-center bg-[#0a0d14]/60 border border-slate-200 dark:border-slate-800/60 rounded-xl">
                              <p className="text-slate-600 dark:text-slate-400 dark:text-slate-400 text-sm">No domains found in this workspace.</p>
                            </div>
                          );
                        }

                        return (
                          <div key={`workspace-split-${wsKey}`} className="mt-6 flex flex-col lg:flex-row min-h-[600px] rounded-lg sm:rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-900/60 shadow-xl backdrop-blur overflow-hidden">
                            {/* Left Sidebar for Domains */}
                            <div className="w-full lg:w-64 flex-shrink-0 bg-gradient-to-br from-slate-900/90 to-slate-900/80 border-r border-slate-200 dark:border-slate-800 flex flex-col">
                              <h4 className="text-[11px] font-bold text-slate-200 dark:text-slate-300 uppercase tracking-wider mb-2 px-4 pt-5">Domains in {workspace.name}</h4>
                              <div className="flex-1 overflow-y-auto">
                                <Suspense fallback={<div className="p-4 text-xs text-slate-500">Loading domains...</div>}>
                                  <DomainList
                                    domains={workspace.domains || []}
                                    selectedDomainId={activeDomainId}
                                    onDomainSelect={(domain) => setActiveDomainId(String(domain.ulid || domain.id))}
                                  />
                                </Suspense>
                              </div>
                            </div>

                            {/* Right Content Area for Dashboards */}
                            <div className="flex-1 min-w-0 bg-gradient-to-br from-slate-900/80 to-slate-900/90 p-0 flex flex-col">
                              {activeDomainInWorkspace ? (
                                <div className="animate-in fade-in slide-in-from-right-4 duration-300 h-full w-full">
                                  <Suspense fallback={<div className="h-full flex items-center justify-center p-8 text-xs text-slate-500">Loading metrics...</div>}>
                                    <DomainDetailsPanel selectedDomain={activeDomainInWorkspace} canManage={false} />
                                  </Suspense>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center justify-center h-full min-h-[300px]">
                                  <Globe className="w-8 h-8 text-slate-600 mb-3" />
                                  <p className="text-slate-600 dark:text-slate-400 dark:text-slate-400 text-[13px]">Select a domain from the sidebar to view its metrics.</p>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminUsers;
