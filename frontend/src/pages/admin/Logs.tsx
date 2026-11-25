import React, { useEffect, useState } from "react";
import { adminApi } from "../../context/admin-auth-context";
import { AlertCircle, RefreshCw, Info, AlertTriangle, ShieldAlert, MessageSquare, Mail, Phone, Code, Bell, Clock, Activity, ArrowUpCircle, ArrowDownCircle, AlertOctagon } from "lucide-react";
import toast from "react-hot-toast";

const TAB_CATEGORIES = [
  { id: 'all', label: 'All Events', icon: Activity },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'integrations', label: 'Integrations', icon: Code },
  { id: 'up', label: 'Up Events', icon: ArrowUpCircle },
  { id: 'down', label: 'Down Events', icon: ArrowDownCircle },
  { id: 'cronjobs', label: 'Cronjobs', icon: Clock },
  { id: 'workers', label: 'Workers', icon: RefreshCw },
  { id: 'errors', label: 'Errors', icon: AlertOctagon },
];

export const AdminLogs = () => {
  const [activeTab, setActiveTab] = useState<string>('all');
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  useEffect(() => {
    fetchLogs();
  }, [activeTab]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const response = await adminApi.get(`/api/admin/logs/advanced?category=${activeTab}`);
      setLogs(response.data.data || []);
    } catch (err) {
      toast.error("Failed to fetch logs");
    } finally {
      setLoading(false);
    }
  };

  const getSeverityIcon = (severity: string) => {
    if (!severity) return <AlertCircle className="w-4 h-4 text-slate-600 dark:text-slate-400 dark:text-slate-400" />;
    switch (severity.toLowerCase()) {
      case "error":
      case "critical":
        return <ShieldAlert className="w-4 h-4 text-rose-500" />;
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case "info":
        return <Info className="w-4 h-4 text-blue-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-slate-600 dark:text-slate-400 dark:text-slate-400" />;
    }
  };

  const getIntegrationIcon = (source: string) => {
    if (!source) return <Bell className="w-5 h-5 text-slate-600 dark:text-slate-400 dark:text-slate-400" />;
    switch (source.toLowerCase()) {
      case 'discord':
      case 'slack':
        return <MessageSquare className="w-5 h-5 text-indigo-400" />;
      case 'whatsapp':
      case 'sms':
        return <MessageSquare className="w-5 h-5 text-emerald-400" />;
      case 'email':
        return <Mail className="w-5 h-5 text-blue-400" />;
      case 'call':
        return <Phone className="w-5 h-5 text-amber-400" />;
      case 'webhook':
        return <Code className="w-5 h-5 text-slate-600 dark:text-slate-400 dark:text-slate-400" />;
      default:
        return <Bell className="w-5 h-5 text-slate-600 dark:text-slate-400 dark:text-slate-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    if (!status) return null;
    const s = status.toLowerCase();
    if (s === 'success' || s === 'sent') {
      return <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-md text-xs font-medium">Success</span>;
    }
    if (s === 'failure' || s === 'failed' || s === 'error') {
      return <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2.5 py-1 rounded-md text-xs font-medium">Failed</span>;
    }
    if (s === 'pending') {
      return <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-md text-xs font-medium">Pending</span>;
    }
    return <span className="bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700 px-2.5 py-1 rounded-md text-xs font-medium capitalize">{status}</span>;
  };

  const getStatusIndicator = (log: any) => {
    const action = log.payload?.action?.toLowerCase() || '';
    const msg = (log.message || '').toLowerCase();
    const evt = (log.event_type || '').toLowerCase();

    const isDown = action === 'down' || msg.includes('down');
    const isUp = action === 'up' || msg.includes('up') || msg.includes('resolved') || msg.includes('start') || evt.includes('up');

    if (isDown) {
      return <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)] absolute -top-1 -right-1" title="Down Event" />;
    }
    if (isUp) {
      return <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] absolute -top-1 -right-1" title="Up/Resolved Event" />;
    }
    return null;
  };

  return (
    <div className="space-y-6">

      {/* Scrollable Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0a0a0a] rounded-t-xl overflow-x-auto custom-scrollbar">
        <div className="flex w-max min-w-full">
          {TAB_CATEGORIES.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${isActive
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50/60 dark:bg-slate-900/50'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900/30'
                  }`}
              >
                <tab.icon className={`w-4 h-4 ${isActive ? 'text-blue-500' : 'text-slate-600 dark:text-slate-400'}`} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800 rounded-b-2xl overflow-hidden shadow-sm -mt-6 border-t-0">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800/60 flex items-center justify-between bg-white dark:bg-[#0f0f0f]">
          <h2 className="text-slate-900 dark:text-white font-medium text-sm flex items-center gap-2">
            <Activity className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            {TAB_CATEGORIES.find(t => t.id === activeTab)?.label}
          </h2>
          <button
            onClick={fetchLogs}
            className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-white px-4 py-2 rounded-xl text-sm transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-600 dark:text-slate-400 font-mono text-sm animate-pulse">Fetching logs...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
              <thead className="text-xs text-slate-600 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-4 font-medium">Source</th>
                  <th className="px-6 py-4 font-medium">Context / Status</th>
                  <th className="px-6 py-4 font-medium">Message</th>
                  <th className="px-6 py-4 font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-600 dark:text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <AlertCircle className="w-8 h-8 text-slate-700" />
                        <p>No logs found for this category.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <React.Fragment key={log.id}>
                      <tr
                        className={`border-b border-slate-200 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors ${log.payload ? 'cursor-pointer' : ''}`}
                        onClick={() => log.payload && setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {/* Rich Icon System based on tab or log type */}
                            {activeTab === 'notifications' || activeTab === 'integrations' ? (
                              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center relative shadow-sm">
                                {getIntegrationIcon(log.source)}
                                {getStatusIndicator(log)}
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
                                {getSeverityIcon(log.severity)}
                                <span className="capitalize font-medium text-slate-600 dark:text-slate-300 text-xs">{log.severity || 'info'}</span>
                              </div>
                            )}
                            {activeTab === 'notifications' || activeTab === 'integrations' ? (
                              <div>
                                <span className="capitalize font-bold text-slate-900 dark:text-slate-200 block">{log.source}</span>
                                <span className="text-[10px] text-slate-600 dark:text-slate-400 dark:text-slate-400 font-mono tracking-wider uppercase">{log.integration_key || log.log_type}</span>
                              </div>
                            ) : null}
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex flex-col items-start gap-1.5">
                            {activeTab === 'notifications' || activeTab === 'integrations' ? (
                              getStatusBadge(log.execution_status)
                            ) : (
                              <span className="bg-blue-500/10 text-blue-400 px-2.5 py-1 rounded-md text-xs border border-blue-500/20 font-medium">
                                {log.source || log.event_type || 'system'}
                              </span>
                            )}
                            {(log.event_type && (activeTab === 'notifications' || activeTab === 'integrations')) && (
                              <span className="text-[11px] text-slate-600 dark:text-slate-400 dark:text-slate-400 capitalize">{log.event_type}</span>
                            )}
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <div className="text-slate-900 dark:text-slate-300 text-sm max-w-md truncate font-medium">
                            {log.message || 'Action recorded'}
                          </div>
                          {log.error_message && (
                            <div className="text-rose-400 text-xs mt-1 truncate max-w-md">
                              {log.error_message}
                            </div>
                          )}
                          {log.payload && (
                            <div className="text-slate-600 dark:text-slate-400 text-xs mt-1 italic group-hover:text-blue-400 transition-colors">
                              Click to view payload
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400 text-xs font-mono whitespace-nowrap">
                          {(() => {
                            if (!log.created_at) return '-';
                            const date = new Date(log.created_at);
                            if (isNaN(date.getTime())) return String(log.created_at);
                            return date.toLocaleString(undefined, {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                              hour12: true,
                            });
                          })()}
                        </td>
                      </tr>

                      {/* Expanded Payload Row */}
                      {expandedLogId === log.id && log.payload && (
                        <tr className="bg-slate-50 dark:bg-[#0f141a]">
                          <td colSpan={4} className="px-6 py-4 border-b border-slate-200 dark:border-slate-800/50">
                            <div className="p-4 bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto shadow-inner">
                              <pre className="text-xs text-slate-600 dark:text-slate-300 font-mono">
                                {JSON.stringify(log.payload, null, 2)}
                              </pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminLogs;
