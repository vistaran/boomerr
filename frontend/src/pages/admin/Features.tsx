import React, { useState, useEffect } from "react";
import { adminApi } from "../../context/admin-auth-context";
import {
  Sparkles,
  Plus,
  Search,
  Pin,
  Clock,
  ExternalLink,
  Edit2,
  Trash2,
  CheckCircle2,
  Eye,
  EyeOff,
  Filter,
  X,
  Layers,
  Calendar,
  Tag,
  Mail,
  Send,
} from "lucide-react";
import toast from "react-hot-toast";

interface FeatureAnnouncement {
  id: number;
  title: string;
  slug: string;
  category: string;
  status: "coming_soon" | "in_beta" | "announced" | "live";
  badge_text: string | null;
  summary: string;
  description: string | null;
  cta_label: string | null;
  cta_url: string | null;
  target_quarter: string | null;
  release_date: string | null;
  is_pinned: boolean;
  is_published: boolean;
  creator?: { id: number; name: string; email: string };
  created_at: string;
}

interface Stats {
  total: number;
  coming_soon: number;
  in_beta: number;
  live: number;
  announced: number;
}

export const AdminFeatures = () => {
  const [features, setFeatures] = useState<FeatureAnnouncement[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFeature, setEditingFeature] = useState<FeatureAnnouncement | null>(null);
  const [saving, setSaving] = useState(false);

  // Form State
  const [form, setForm] = useState({
    title: "",
    slug: "",
    category: "general",
    status: "coming_soon",
    badge_text: "",
    summary: "",
    description: "",
    cta_label: "",
    cta_url: "",
    target_quarter: "NOW",
    release_date: "",
    is_pinned: false,
    is_published: true,
    send_email: true,
  });

  const fetchFeatures = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedStatus !== "all") params.append("status", selectedStatus);
      if (selectedCategory !== "all") params.append("category", selectedCategory);
      if (searchQuery) params.append("search", searchQuery);

      const res = await adminApi.get(`/admin/features?${params.toString()}`);
      setFeatures(res.data.features.data || []);
      setStats(res.data.stats || null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load feature announcements");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeatures();
  }, [selectedStatus, selectedCategory]);

  const handleOpenModal = (feature?: FeatureAnnouncement) => {
    if (feature) {
      setEditingFeature(feature);
      setForm({
        title: feature.title,
        slug: feature.slug,
        category: feature.category,
        status: feature.status,
        badge_text: feature.badge_text || "",
        summary: feature.summary,
        description: feature.description || "",
        cta_label: feature.cta_label || "",
        cta_url: feature.cta_url || "",
        target_quarter: feature.target_quarter || "",
        release_date: feature.release_date || "",
        is_pinned: feature.is_pinned,
        is_published: feature.is_published,
        send_email: false,
      });
    } else {
      setEditingFeature(null);
      setForm({
        title: "",
        slug: "",
        category: "monitoring",
        status: "coming_soon",
        badge_text: "SOON",
        summary: "",
        description: "",
        cta_label: "",
        cta_url: "",
        target_quarter: "NOW",
        release_date: "",
        is_pinned: false,
        is_published: true,
        send_email: true,
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.summary.trim()) {
      toast.error("Title and Summary are required");
      return;
    }

    try {
      setSaving(true);
      if (editingFeature) {
        await adminApi.put(`/admin/features/${editingFeature.id}`, form);
        toast.success("Feature announcement updated");
      } else {
        await adminApi.post(`/admin/features`, form);
        toast.success(
          form.send_email
            ? "Feature announced & emails dispatched to users!"
            : "Feature announced successfully"
        );
      }
      setIsModalOpen(false);
      fetchFeatures();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to save announcement");
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePin = async (id: number) => {
    try {
      const res = await adminApi.post(`/admin/features/${id}/toggle-pin`);
      toast.success(res.data.message);
      setFeatures((prev) =>
        prev.map((f) => (f.id === id ? { ...f, is_pinned: res.data.is_pinned } : f))
      );
    } catch (err) {
      toast.error("Failed to update pin status");
    }
  };

  const handleBroadcastEmail = async (feature: FeatureAnnouncement) => {
    if (!confirm(`Are you sure you want to send feature announcement emails for "${feature.title}" to ALL users?`)) return;
    try {
      const res = await adminApi.post(`/admin/features/${feature.id}/broadcast-email`);
      toast.success(res.data.message || "Announcement emails dispatched!");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to broadcast email");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this feature announcement?")) return;
    try {
      await adminApi.delete(`/admin/features/${id}`);
      toast.success("Announcement deleted");
      fetchFeatures();
    } catch (err) {
      toast.error("Failed to delete announcement");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "live":
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">🟢 Live in Prod</span>;
      case "in_beta":
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">🟡 In Beta</span>;
      case "announced":
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">📢 Announced</span>;
      case "coming_soon":
      default:
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">🚀 Coming Soon</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Metrics */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-amber-400" />
            Feature Announcements
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Announce incoming features, public roadmap items, and new platform rollouts.
          </p>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-blue-500/20"
        >
          <Plus className="w-4 h-4" />
          Announce New Feature
        </button>
      </div>

      {/* Metrics Row */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">Total Tracked</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats.total}</p>
          </div>
          <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
            <p className="text-xs text-blue-400 font-medium">🚀 Coming Soon</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats.coming_soon}</p>
          </div>
          <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
            <p className="text-xs text-amber-400 font-medium">🟡 In Beta</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats.in_beta}</p>
          </div>
          <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
            <p className="text-xs text-emerald-400 font-medium">🟢 Live in Production</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats.live}</p>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
          {[
            { id: "all", label: "All" },
            { id: "coming_soon", label: "Coming Soon" },
            { id: "in_beta", label: "Beta" },
            { id: "announced", label: "Announced" },
            { id: "live", label: "Live" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedStatus(tab.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                selectedStatus === tab.id
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                  : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-slate-600 dark:text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search features..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchFeatures()}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-4 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-600 dark:placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          <button
            onClick={() => fetchFeatures()}
            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-medium transition-colors"
          >
            Filter
          </button>
        </div>
      </div>

      {/* Feature Cards Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-24 text-slate-600 dark:text-slate-400">
          Loading announcements...
        </div>
      ) : features.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800 rounded-2xl">
          <Sparkles className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
          <p className="text-slate-900 dark:text-white font-medium text-base">No announcements found</p>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Get started by announcing an upcoming or released feature.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <div
              key={feature.id}
              className={`relative bg-white dark:bg-[#0a0a0a] border rounded-2xl p-6 transition-all hover:border-slate-300 dark:hover:border-slate-700 flex flex-col justify-between shadow-sm ${
                feature.is_pinned
                  ? "border-blue-500/40 ring-1 ring-blue-500/20"
                  : "border-slate-200 dark:border-slate-800"
              }`}
            >
              {/* Header Badges */}
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {getStatusBadge(feature.status)}
                    {feature.badge_text && (
                      <span className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-purple-500/10 text-purple-400 uppercase tracking-wider">
                        {feature.badge_text}
                      </span>
                    )}
                    {feature.target_quarter && (
                      <span className="px-2 py-0.5 text-[11px] font-medium rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {feature.target_quarter}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleBroadcastEmail(feature)}
                      title="Send announcement email to all users"
                      className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-500/10 transition-colors"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleTogglePin(feature.id)}
                      title={feature.is_pinned ? "Unpin feature" : "Pin to top"}
                      className={`p-1.5 rounded-lg transition-colors ${
                        feature.is_pinned
                          ? "text-blue-500 bg-blue-500/10"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      <Pin className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleOpenModal(feature)}
                      title="Edit announcement"
                      className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(feature.id)}
                      title="Delete announcement"
                      className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                  {feature.title}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                  {feature.summary}
                </p>
              </div>

              {/* Footer CTA & Metadata */}
              <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-900 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                <span className="capitalize text-slate-600 dark:text-slate-400">
                  📁 {feature.category.replace("_", " ")}
                </span>

                {feature.cta_label && feature.cta_url && (
                  <a
                    href={feature.cta_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 font-semibold flex items-center gap-1 transition-colors"
                  >
                    {feature.cta_label}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl relative my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                {editingFeature ? "Edit Announcement" : "Announce New Feature"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white p-1 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Feature Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Custom Domain Status Pages"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Status *
                  </label>
                  <select
                    value={form.status}
                    onChange={(e: any) => setForm({ ...form, status: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="coming_soon">Coming Soon</option>
                    <option value="in_beta">In Beta</option>
                    <option value="announced">Announced</option>
                    <option value="live">Live in Production</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Category *
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="status_pages">Status Pages</option>
                    <option value="monitoring">Monitoring Probes</option>
                    <option value="notifications">Alerts & Integrations</option>
                    <option value="billing">Plans & Billing</option>
                    <option value="general">Platform Core</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Badge Text (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="HOT, PREVIEW, NEW"
                    value={form.badge_text}
                    onChange={(e) => setForm({ ...form, badge_text: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    ETA / Target Quarter
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. NOW, Q4 2026"
                    value={form.target_quarter}
                    onChange={(e) => setForm({ ...form, target_quarter: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Short Summary *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Concise overview visible on the card/banner"
                  value={form.summary}
                  onChange={(e) => setForm({ ...form, summary: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Call-to-Action Label
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. View Preview"
                    value={form.cta_label}
                    onChange={(e) => setForm({ ...form, cta_label: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    CTA Destination URL
                  </label>
                  <input
                    type="text"
                    placeholder="/admin/status-page"
                    value={form.cta_url}
                    onChange={(e) => setForm({ ...form, cta_url: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-blue-600 dark:text-blue-400">
                  <input
                    type="checkbox"
                    checked={form.send_email}
                    onChange={(e) => setForm({ ...form, send_email: e.target.checked })}
                    className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-0"
                  />
                  <Mail className="w-3.5 h-3.5" />
                  Send Announcement Email to All Users
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={form.is_pinned}
                    onChange={(e) => setForm({ ...form, is_pinned: e.target.checked })}
                    className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-0"
                  />
                  Pin to Top Spotlight
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={form.is_published}
                    onChange={(e) => setForm({ ...form, is_published: e.target.checked })}
                    className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-0"
                  />
                  Publish Announcement
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors shadow-lg shadow-blue-500/20"
                >
                  {saving ? "Saving..." : editingFeature ? "Save Changes" : "Announce Feature"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default AdminFeatures;
