import React, { useEffect, useState } from "react";
import { adminApi } from "../../context/admin-auth-context";
import { Users, Globe, CreditCard, AlertTriangle, ArrowUpRight, Sparkles, Clock, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";

interface DashboardStats {
  stats: {
    total_users: number;
    active_domains: number;
    active_subscriptions: number;
    active_incidents: number;
  };
  recent_users: any[];
  recent_activities: any[];
  latest_errors: any[];
}

export const AdminDashboard = () => {
  const [data, setData] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await adminApi.get("/api/admin/dashboard");
        setData(response.data);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-slate-600 dark:text-slate-400">Loading metrics...</div>;
  }

  const statCards = [
    { name: "Total Users", value: data?.stats.total_users || 0, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
    { name: "Active Domains", value: data?.stats.active_domains || 0, icon: Globe, color: "text-indigo-500", bg: "bg-indigo-500/10" },
    { name: "Active Subscriptions", value: data?.stats.active_subscriptions || 0, icon: CreditCard, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { name: "Active Incidents", value: data?.stats.active_incidents || 0, icon: AlertTriangle, color: "text-rose-500", bg: "bg-rose-500/10" },
  ];

  return (
    <div className="space-y-6">
      {/* Feature Announcements Spotlight */}
      <div className="bg-gradient-to-r from-blue-900/20 via-indigo-900/10 to-purple-900/20 border border-blue-500/30 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-500 flex-shrink-0">
              <Sparkles className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-blue-500/20 text-blue-400 uppercase tracking-wider">
                  Upcoming Roadmap & Announcements
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">Live in Boomerr Admin</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                Public Feature Rollouts & Previews
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
                Keep the team aligned on what is coming soon (e.g. Custom Domain Status Pages, Instant WhatsApp Alerts) and what is already live in production.
              </p>
            </div>
          </div>
          <Link
            to="/admin/features"
            className="self-start sm:self-center flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition-colors shadow-lg shadow-blue-500/20 whitespace-nowrap"
          >
            Manage Features
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, i) => (
          <div key={i} className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 hover:border-slate-300 dark:hover:border-slate-700 transition-colors shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-slate-600 dark:text-slate-400 text-sm font-medium">{stat.name}</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{stat.value}</p>
              </div>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.bg}`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-emerald-600 dark:text-emerald-500 flex items-center font-medium">
                <ArrowUpRight className="w-4 h-4 mr-1" />
                12%
              </span>
              <span className="text-slate-600 dark:text-slate-400 ml-2">vs last month</span>
            </div>
          </div>
        ))}
      </div>

      {/* Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Recent Registrations</h2>
          <div className="space-y-3">
            {data?.recent_users.length === 0 ? (
              <p className="text-slate-600 dark:text-slate-400 text-sm">No recent users.</p>
            ) : (
              data?.recent_users.map((u, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 rounded-full flex items-center justify-center text-slate-700 dark:text-slate-300 font-semibold flex-shrink-0">
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{u.name}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">{u.email}</p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                    {new Date(u.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">System Alerts</h2>
          <div className="space-y-4">
            {data?.latest_errors.length === 0 ? (
              <p className="text-slate-600 dark:text-slate-400 text-sm">No recent errors detected.</p>
            ) : (
              data?.latest_errors.map((err, i) => (
                <div key={i} className="p-4 border border-rose-200 dark:border-rose-900/30 bg-rose-50/70 dark:bg-rose-500/5 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-500" />
                    <span className="text-sm font-medium text-rose-700 dark:text-rose-400">{(err.source || 'System')} Error</span>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-2">{err.message}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">{new Date(err.created_at).toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
