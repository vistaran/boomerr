import React, { useEffect, useState } from "react";
import { adminApi } from "../../context/admin-auth-context";
import { Server, RefreshCw, Activity, CheckCircle, Zap } from "lucide-react";
import toast from "react-hot-toast";

export const NodeHealth = () => {
  const [nodes, setNodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNodeHealth = async () => {
    try {
      setLoading(true);
      const res = await adminApi.get("/api/admin/node-health");
      setNodes(res.data.data || []);
    } catch (err) {
      toast.error("Failed to fetch node health metrics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNodeHealth();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "healthy":
        return <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full text-xs font-medium">Healthy</span>;
      case "degraded":
        return <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-full text-xs font-medium">Degraded</span>;
      default:
        return <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2.5 py-1 rounded-full text-xs font-medium">Offline</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Server className="w-6 h-6 text-indigo-400" />
            Execution Node Health
          </h1>
          <p className="text-slate-600 dark:text-slate-400 dark:text-slate-400 text-sm mt-1">Real-time status & latency across all 5 monitoring regions</p>
        </div>
        <button
          onClick={fetchNodeHealth}
          className="bg-white dark:bg-[#111] hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-white px-4 py-2 rounded-xl text-sm transition-colors flex items-center gap-2 shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Nodes
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {nodes.map((node) => (
          <div key={node.node_id} className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 hover:border-slate-300 dark:border-slate-700 transition-colors">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">{node.name}</h2>
                <span className="text-xs font-mono text-slate-600 dark:text-slate-400 dark:text-slate-400">{node.aws_region}</span>
              </div>
              {getStatusBadge(node.status)}
            </div>

            <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800/60 text-sm">
              <div className="flex justify-between items-center text-slate-600 dark:text-slate-400 dark:text-slate-400">
                <span className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" /> Latency:
                </span>
                <span className="font-mono text-slate-900 dark:text-white font-medium">
                  {node.latency_ms !== null ? `${node.latency_ms} ms` : '-'}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-600 dark:text-slate-400 dark:text-slate-400">
                <span className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" /> 24h Success Rate:
                </span>
                <span className="font-mono text-slate-900 dark:text-white font-medium">
                  {node.success_rate_24h !== null ? `${node.success_rate_24h}%` : '100%'}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-600 dark:text-slate-400 dark:text-slate-400 text-xs">
                <span>Last Heartbeat:</span>
                <span className="text-slate-600 dark:text-slate-400 dark:text-slate-400">
                  {node.last_heartbeat_ago_s !== null ? `${node.last_heartbeat_ago_s}s ago` : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NodeHealth;
