import React, { useEffect, useState } from "react";
import { adminApi } from "../../context/admin-auth-context";
import { CreditCard, Search, Building } from "lucide-react";
import toast from "react-hot-toast";

export const AdminBilling = () => {
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const fetchSubscriptions = async () => {
    try {
      setLoading(true);
      const response = await adminApi.get("/api/admin/billing");
      setSubscriptions(response.data.data || []);
    } catch (err) {
      toast.error("Failed to fetch billing data");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800/60 bg-white dark:bg-[#0a0a0a] flex items-center justify-between">
          <h2 className="text-slate-900 dark:text-white font-medium text-sm">Subscriptions</h2>
          <div className="relative">
            <Search className="w-5 h-5 text-slate-600 dark:text-slate-400 dark:text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search subscriptions..."
              className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-blue-500 w-64 transition-colors"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-600 dark:text-slate-400 dark:text-slate-400">Loading subscriptions...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
              <thead className="text-xs text-slate-600 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-4 font-medium">Workspace</th>
                  <th className="px-6 py-4 font-medium">Plan ID</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Amount</th>
                  <th className="px-6 py-4 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center">No subscriptions found.</td>
                  </tr>
                ) : (
                  subscriptions.map((sub) => (
                    <tr key={sub.id} className="border-b border-slate-200 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Building className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                          <span className="font-medium text-slate-900 dark:text-slate-200">
                            {sub.workspace?.name || `Workspace #${sub.workspace_id}`}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-slate-700 dark:text-slate-300">{sub.plan_price_id}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-medium border ${sub.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                          }`}>
                          {sub.status || 'unknown'}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-200">
                        {sub.unit_amount !== null && sub.unit_amount !== undefined
                          ? sub.unit_amount === 0
                            ? 'Free'
                            : `${(sub.unit_amount / 100).toFixed(2)} ${sub.currency?.toUpperCase() || ''}`
                          : '-'}
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-400 dark:text-slate-400 text-xs">
                        {new Date(sub.created_at).toLocaleDateString()}
                      </td>
                    </tr>
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

export default AdminBilling;
