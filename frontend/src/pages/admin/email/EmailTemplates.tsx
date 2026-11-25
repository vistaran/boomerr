import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import emailTemplateApi, { type EmailTemplate } from '../../../services/admin/email-templates';
import EmailPreviewModal from '../../../components/admin/email/EmailPreviewModal';
import toast from 'react-hot-toast';
import {
  Mail,
  Plus,
  Search,
  Eye,
  Edit,
  Trash2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  GitBranch,
  Clock,
  ExternalLink,
} from 'lucide-react';

const CATEGORIES = [
  { id: 'all', label: 'All Categories' },
  { id: 'onboarding', label: 'Onboarding' },
  { id: 'lifecycle', label: 'Lifecycle' },
  { id: 'newsletter', label: 'Newsletter' },
  { id: 'transactional', label: 'Transactional' },
  { id: 'alert', label: 'Alerts' },
];

export const AdminEmailTemplates: React.FC = () => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSequence, setSelectedSequence] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Preview Modal state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);

  // Delete Modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<EmailTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await emailTemplateApi.getTemplates();
      if (res.success && Array.isArray(res.data)) {
        setTemplates(res.data);
      } else {
        toast.error('Failed to load email templates');
      }
    } catch (err: any) {
      console.error('Error loading email templates:', err);
      toast.error(err.response?.data?.message || 'Could not connect to email templates API');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const filteredTemplates = useMemo(() => {
    return templates.filter((tpl) => {
      // Category match
      if (selectedCategory !== 'all' && tpl.category !== selectedCategory) {
        return false;
      }
      // Sequence match
      if (selectedSequence !== 'all') {
        if (selectedSequence === 'none' && tpl.sequence_name) return false;
        if (selectedSequence !== 'none' && tpl.sequence_name !== selectedSequence) return false;
      }
      // Status match
      if (statusFilter === 'active' && !tpl.is_active) return false;
      if (statusFilter === 'inactive' && tpl.is_active) return false;

      // Search match
      if (search.trim()) {
        const query = search.toLowerCase();
        const nameMatch = tpl.name?.toLowerCase().includes(query);
        const keyMatch = tpl.key?.toLowerCase().includes(query);
        const subjectMatch = tpl.subject?.toLowerCase().includes(query);
        const seqMatch = tpl.sequence_name?.toLowerCase().includes(query);
        return nameMatch || keyMatch || subjectMatch || seqMatch;
      }

      return true;
    });
  }, [templates, selectedCategory, selectedSequence, statusFilter, search]);

  const handleToggleActive = async (template: EmailTemplate) => {
    const newStatus = !template.is_active;
    setTemplates((prev) =>
      prev.map((t) => (t.id === template.id ? { ...t, is_active: newStatus } : t))
    );

    try {
      await emailTemplateApi.toggleActive(template.id, newStatus);
      toast.success(`Template '${template.name}' is now ${newStatus ? 'active' : 'inactive'}.`);
    } catch (err) {
      setTemplates((prev) =>
        prev.map((t) => (t.id === template.id ? { ...t, is_active: !newStatus } : t))
      );
      toast.error('Failed to update template status.');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!templateToDelete) return;
    setDeleting(true);
    try {
      await emailTemplateApi.deleteTemplate(templateToDelete.id);
      toast.success(`Template '${templateToDelete.name}' deleted successfully.`);
      setTemplates((prev) => prev.filter((t) => t.id !== templateToDelete.id));
      setDeleteModalOpen(false);
      setTemplateToDelete(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete template.');
    } finally {
      setDeleting(false);
    }
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'onboarding':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'lifecycle':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'newsletter':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'transactional':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'alert':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      default:
        return 'bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Mail className="w-6 h-6 text-blue-500" />
            Email Templates
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 dark:text-slate-400 mt-1">
            Design and manage automated lifecycle and notification emails with live visual customization.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/admin/email/sequence"
            className="px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-2"
          >
            <GitBranch className="w-4 h-4 text-blue-400" />
            <span>Sequences Journey</span>
          </Link>
          <Link
            to="/admin/email/templates/create"
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Create Template</span>
          </Link>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        {/* Filter Toolbar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0a0a0a] flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-600 dark:text-slate-400 dark:text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, key, subject, or sequence..."
              className="w-full bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Category Dropdown */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
            >
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>

            {/* Sequence Dropdown */}
            <select
              value={selectedSequence}
              onChange={(e) => setSelectedSequence(e.target.value)}
              className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Pipelines</option>
              <option value="onboarding">Onboarding</option>
              <option value="value_summary">Value Summary</option>
              <option value="churn_prevention">Churn Prevention</option>
              <option value="monitor_limits">Monitor Limits</option>
              <option value="none">Standalone / No Pipeline</option>
            </select>

            {/* Status Dropdown */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>

            {/* Refresh */}
            <button
              type="button"
              onClick={fetchTemplates}
              className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Templates Table */}
        {loading ? (
          <div className="p-16 text-center text-slate-600 dark:text-slate-400 flex flex-col items-center justify-center">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-500 mb-2" />
            <span className="text-xs">Loading email templates...</span>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="p-16 text-center text-slate-600 dark:text-slate-400 flex flex-col items-center justify-center">
            <Mail className="w-10 h-10 text-slate-700 mb-3" />
            <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">No email templates found</span>
            <span className="text-xs text-slate-600 dark:text-slate-400 mt-1">Try adjusting your search terms or filters</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950/40 text-[11px] uppercase tracking-wider text-slate-600 dark:text-slate-400 font-semibold">
                  <th className="py-3.5 px-4">Template Name & Key</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Pipeline & Step</th>
                  <th className="py-3.5 px-4">Trigger & Delay</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-xs text-slate-600 dark:text-slate-300">
                {filteredTemplates.map((template) => (
                  <tr key={template.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                    {/* Name & Key */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
                          <Mail className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <Link
                            to={`/admin/email/templates/${template.id}/edit`}
                            className="font-semibold text-slate-900 dark:text-white hover:text-blue-400 transition-colors truncate block"
                          >
                            {template.name}
                          </Link>
                          <span className="font-mono text-[10px] text-slate-600 dark:text-slate-400 dark:text-slate-400 block truncate">
                            {template.key}
                          </span>
                          <span className="text-[11px] text-slate-600 dark:text-slate-400 dark:text-slate-400 truncate block mt-0.5">
                            {template.subject}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium border uppercase tracking-wider ${getCategoryBadge(
                          template.category
                        )}`}
                      >
                        {template.category}
                      </span>
                    </td>

                    {/* Pipeline & Step */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {template.sequence_name ? (
                        <div className="flex items-center gap-1.5">
                          <GitBranch className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          <div>
                            <span className="font-mono font-medium text-slate-200">
                              {template.sequence_name}
                            </span>
                            <span className="text-[10px] text-slate-600 dark:text-slate-400 dark:text-slate-400 ml-1.5">
                              (Step {template.step_order || 1})
                            </span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-600 font-mono text-[11px]">-</span>
                      )}
                    </td>

                    {/* Trigger & Delay */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400 dark:text-slate-400 shrink-0" />
                        <span className="text-slate-600 dark:text-slate-300">
                          {template.delay_value !== null && template.delay_value !== undefined
                            ? `${template.delay_value} ${template.delay_unit || 'hours'}`
                            : 'Immediate'}
                        </span>
                        <span className="text-[11px] text-slate-600 dark:text-slate-400 dark:text-slate-400">
                          after {template.trigger_event || 'trigger'}
                        </span>
                      </div>
                    </td>

                    {/* Status Toggle */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(template)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${template.is_active
                          ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/20'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                          }`}
                        title="Click to toggle status"
                      >
                        {template.is_active ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Active</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3" />
                            <span>Inactive</span>
                          </>
                        )}
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewTemplate(template);
                            setPreviewOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Live Preview"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <Link
                          to={`/admin/email/templates/${template.id}/edit`}
                          className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Edit Template"
                        >
                          <Edit className="w-4 h-4" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            setTemplateToDelete(template);
                            setDeleteModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Delete Template"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer Summary */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0a0a0a] flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 dark:text-slate-400">
          <span>
            Showing <strong className="text-slate-600 dark:text-slate-300">{filteredTemplates.length}</strong> of{' '}
            <strong className="text-slate-600 dark:text-slate-300">{templates.length}</strong> total email templates
          </span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Active ({templates.filter((t) => t.is_active).length})</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-600"></span>
              <span>Inactive ({templates.filter((t) => !t.is_active).length})</span>
            </span>
          </div>
        </div>
      </div>

      {/* Live Preview Modal */}
      <EmailPreviewModal
        modalOpen={previewOpen}
        setModalOpen={setPreviewOpen}
        template={previewTemplate}
      />

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && templateToDelete && (
        <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-3 sm:p-6">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => setDeleteModalOpen(false)}
          />
          <div className="relative z-10 bg-white dark:bg-[#0a0a0a] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 max-w-md w-full text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Delete Email Template?</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 dark:text-slate-400 mt-1">
                Are you sure you want to delete{' '}
                <strong className="text-slate-200">"{templateToDelete.name}"</strong>? Any active
                automation pipelines referencing this template will stop sending this step.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteConfirm}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminEmailTemplates;
