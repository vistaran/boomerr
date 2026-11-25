import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { adminApi } from "../../context/admin-auth-context";
import { useAdminTheme } from "../../context/admin-theme-context";
import { ArrowLeft, Shield, Activity, Clock, Mail, Info } from "lucide-react";
import toast from "react-hot-toast";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';

export const AdminDetail = () => {
  const { id } = useParams();
  const { theme } = useAdminTheme();
  const isDark = theme === "dark";
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminDetails();
  }, [id]);

  const fetchAdminDetails = async () => {
    try {
      setLoading(true);
      const response = await adminApi.get(`/api/admin/admins/${id}`);
      setData(response.data.data);
    } catch (err) {
      toast.error("Failed to fetch details");
    } finally {
      setLoading(false);
    }
  };

  if (loading || !data) {
    return <div className="p-8 text-center text-slate-600 dark:text-slate-400">Loading profile...</div>;
  }

  const { admin, stats, chart } = data;

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Header Section */}
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
           <Link to="/admin/admins" className="text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors bg-white dark:bg-[#0a0d14] hover:bg-slate-50 dark:hover:bg-slate-800 p-2.5 rounded-full border border-slate-200 dark:border-slate-800/60 shadow-sm">
             <ArrowLeft className="w-5 h-5" />
           </Link>
           <div>
             <h1 className="text-[22px] font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
                {admin.name}
             </h1>
             <p className="text-slate-600 dark:text-slate-400 text-[13px] mt-0.5 flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {admin.email}</p>
           </div>
           
           <div className="ml-auto flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-3 py-1.5 rounded-lg text-sm font-medium border border-blue-200 dark:border-blue-500/20">
                <Shield className="w-4 h-4" />
                {stats.role || 'Super Admin'}
              </div>
           </div>
        </div>
      </div>

      <div className="space-y-6 mt-2">
        {/* Stat Cards Row */}
        <div className="flex w-full gap-4 overflow-x-auto pb-2">
            <div className="bg-white dark:bg-[#0a0d14] border border-slate-200 dark:border-slate-800/60 rounded-xl px-5 py-4 flex-1 min-w-[150px] shadow-sm">
              <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 tracking-wider uppercase mb-1.5">
                Account Status
              </p>
              <p className={`text-[17px] font-semibold tracking-tight ${stats.account_status === 'Active' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}`}>
                {stats.account_status}
              </p>
            </div>
            
            <div className="bg-white dark:bg-[#0a0d14] border border-slate-200 dark:border-slate-800/60 rounded-xl px-5 py-4 flex-1 min-w-[150px] shadow-sm">
              <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 tracking-wider uppercase mb-1.5 flex items-center gap-1">
                Total Logins <Info className="w-3 h-3" />
              </p>
              <p className="text-[17px] font-semibold tracking-tight text-blue-600 dark:text-blue-400">
                {stats.total_logins}
              </p>
            </div>
            
            <div className="bg-white dark:bg-[#0a0d14] border border-slate-200 dark:border-slate-800/60 rounded-xl px-5 py-4 flex-1 min-w-[150px] shadow-sm">
              <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 tracking-wider uppercase mb-1.5">
                Last Active
              </p>
              <p className="text-[17px] font-medium tracking-tight text-slate-900 dark:text-slate-100">
                {stats.last_active}
              </p>
            </div>
            
            <div className="bg-white dark:bg-[#0a0d14] border border-slate-200 dark:border-slate-800/60 rounded-xl px-5 py-4 flex-1 min-w-[200px] shadow-sm">
              <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 tracking-wider uppercase mb-1.5 flex items-center gap-1">
                Created At <Clock className="w-3 h-3" />
              </p>
              <p className="text-[15px] font-medium tracking-tight text-slate-900 dark:text-slate-100">
                {new Date(admin.created_at).toLocaleString()}
              </p>
            </div>
        </div>

        {/* Chart Section */}
        <div className="flex flex-col mt-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-[17px] font-semibold text-slate-900 dark:text-slate-200 tracking-tight flex items-center gap-2">
                  <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  Admin Activity Overview
                </h3>
            </div>

            <div className="h-[320px] bg-white dark:bg-[#0a0d14] border border-slate-200 dark:border-slate-800/60 rounded-xl p-5 flex flex-col shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300 font-medium">
                      Actions Performed <Info className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                  </div>
                </div>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chart}>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#1e293b" : "#e2e8f0"} vertical={false} />
                      <XAxis dataKey="time" stroke={isDark ? "#475569" : "#94a3b8"} fontSize={11} tickMargin={12} axisLine={false} tickLine={false} />
                      <YAxis stroke={isDark ? "#475569" : "#94a3b8"} fontSize={11} axisLine={false} tickLine={false} width={40} />
                      <Line type="monotone" dataKey="actions" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4, fill: isDark ? "#0a0d14" : "#ffffff", stroke: "#3b82f6", strokeWidth: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDetail;
