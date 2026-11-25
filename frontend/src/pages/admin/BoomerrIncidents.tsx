import React, { useEffect, useState } from "react";
import { adminApi } from "../../context/admin-auth-context";
import { AlertCircle, Plus, CheckCircle, RefreshCw, Trash2, Edit2, ShieldAlert } from "lucide-react";
import toast from "react-hot-toast";

export const BoomerrIncidents = () => {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [form, setForm] = useState({
    title: "",
    status: "investigating",
    impact: "",
    cause: "",
    affected_services: "uptime-monitoring",
  });
  const [formErrors, setFormErrors] = useState<{ title?: string; impact?: string }>({});

  const fetchIncidents = async () => {
    try {
      setLoading(true);
      const res = await adminApi.get("/api/admin/boomerr-incidents");
      setIncidents(res.data.data || []);
    } catch (err) {
      toast.error("Failed to load platform incidents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { title?: string; impact?: string } = {};

    if (!form.title.trim()) {
      errors.title = "Incident title is required";
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});
    try {
      const payload = {
        title: form.title,
        status: form.status,
        impact: form.impact,
        cause: form.cause,
        affected_services: form.affected_services.split(",").map((s) => s.trim()),
        started_at: new Date().toISOString(),
      };

      if (editingId) {
        await adminApi.put(`/api/admin/boomerr-incidents/${editingId}`, payload);
        toast.success("Incident updated");
      } else {
        await adminApi.post("/api/admin/boomerr-incidents", payload);
        toast.success("Incident created");
      }

      setShowModal(false);
      resetForm();
      fetchIncidents();
    } catch (err) {
      toast.error("Failed to save incident");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this incident?")) return;
    try {
      await adminApi.delete(`/api/admin/boomerr-incidents/${id}`);
      toast.success("Incident deleted");
      fetchIncidents();
    } catch (err) {
      toast.error("Failed to delete incident");
    }
  };

  const resetForm = () => {
    setForm({ title: "", status: "investigating", impact: "", cause: "", affected_services: "uptime-monitoring" });
    setEditingId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-rose-500" />
            Platform Incidents Management
          </h1>
          <p className="text-slate-600 dark:text-slate-400 dark:text-slate-400 text-sm mt-1">Manage public platform incidents displayed on boomerr.ai/status</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Incident
        </button>
      </div>

      <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-slate-600 dark:text-slate-400">Loading incidents...</div>
        ) : incidents.length === 0 ? (
          <div className="p-8 text-center text-slate-600 dark:text-slate-400">No platform incidents logged.</div>
        ) : (
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
            <thead className="text-xs text-slate-600 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4 font-medium">Title</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Started At</th>
                <th className="px-6 py-4 font-medium">Duration</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((inc) => (
                <tr key={inc.id} className="border-b border-slate-200 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{inc.title}</td>
                  <td className="px-6 py-4">
                    <span className="capitalize bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-md text-xs border border-slate-200 dark:border-slate-700">
                      {inc.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-400 dark:text-slate-400">
                    {new Date(inc.started_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-400 dark:text-slate-400 font-mono">
                    {inc.duration || "Ongoing"}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleDelete(inc.id)}
                      className="text-rose-400 hover:text-rose-300 p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Log Platform Incident</h2>
            <form onSubmit={handleSave} noValidate className="space-y-4 text-sm">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 text-xs mb-1 font-medium">Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => {
                    setForm({ ...form, title: e.target.value });
                    if (formErrors.title) setFormErrors({ ...formErrors, title: undefined });
                  }}
                  className={`w-full bg-white dark:bg-slate-950 border rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none transition-all ${
                    formErrors.title
                      ? "border-rose-500/80 bg-rose-500/[0.03] focus:border-rose-500 ring-1 ring-rose-500/30"
                      : "border-slate-200 dark:border-slate-800 focus:border-indigo-500"
                  }`}
                  placeholder="e.g. Asia Pacific Regional Node Degradation"
                />
                {formErrors.title && (
                  <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    {formErrors.title}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 text-xs mb-1 font-medium">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="investigating">Investigating</option>
                  <option value="identified">Cause Identified</option>
                  <option value="monitoring">Monitoring Fix</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 text-xs mb-1 font-medium">Impact Description</label>
                <textarea
                  value={form.impact}
                  onChange={(e) => setForm({ ...form, impact: e.target.value })}
                  rows={2}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  placeholder="Describe impact on monitoring checks..."
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 text-xs mb-1 font-medium">Affected Services (comma separated)</label>
                <input
                  type="text"
                  value={form.affected_services}
                  onChange={(e) => setForm({ ...form, affected_services: e.target.value })}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  placeholder="uptime-monitoring, node-ap-south-1"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                >
                  Save Incident
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BoomerrIncidents;
