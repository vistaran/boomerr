import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import emailTemplateApi, { type EmailTemplate } from '../../../services/admin/email-templates';
import EmailPreviewModal from '../../../components/admin/email/EmailPreviewModal';
import VisualEmailCustomizer from '../../../components/admin/email/VisualEmailCustomizer';
import FieldTooltip from '../../../components/admin/common/FieldTooltip';
import toast from 'react-hot-toast';
import {
  Mail,
  ArrowLeft,
  Eye,
  Check,
  Clock,
  Paintbrush,
  Settings,
  Plus,
  RefreshCw,
} from 'lucide-react';

export const AdminEditEmailTemplate: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeMainTab, setActiveMainTab] = useState<'visual_design' | 'scheduling' | 'settings'>('visual_design');

  const [formData, setFormData] = useState<Partial<EmailTemplate>>({
    name: '',
    key: '',
    category: 'onboarding',
    sequence_name: '',
    step_order: 1,
    delay_value: 0,
    delay_unit: 'hours',
    trigger_event: 'signup',
    trigger_condition: '',
    subject: '',
    description: '',
    body_html: '',
    variables: ['firstName', 'unsubscribeUrl'],
    is_active: true,
  });

  const [varInput, setVarInput] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    const loadTemplate = async () => {
      setLoading(true);
      try {
        const res = await emailTemplateApi.getTemplate(id);
        if (res.success && res.data) {
          setFormData(res.data);
        } else {
          toast.error('Failed to load email template details.');
        }
      } catch (err: any) {
        console.error('Error loading template:', err);
        toast.error(err.response?.data?.message || 'Error fetching email template.');
      } finally {
        setLoading(false);
      }
    };

    loadTemplate();
  }, [id]);

  const handleAddVariable = () => {
    const trimmed = varInput.trim().replace(/[^a-zA-Z0-9_\.]/g, '');
    const currentVars = formData.variables || [];
    if (trimmed && !currentVars.includes(trimmed)) {
      setFormData((prev) => ({
        ...prev,
        variables: [...currentVars, trimmed],
      }));
      setVarInput('');
    }
  };

  const handleRemoveVariable = (varName: string) => {
    const currentVars = formData.variables || [];
    setFormData((prev) => ({
      ...prev,
      variables: currentVars.filter((v) => v !== varName),
    }));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!id) return;
    if (!formData.name?.trim()) {
      toast.error('Please provide a template name.');
      return;
    }
    if (!formData.subject?.trim()) {
      toast.error('Please provide an email subject line.');
      return;
    }

    setSaving(true);
    try {
      const res = await emailTemplateApi.updateTemplate(id, formData);
      if (res.success) {
        toast.success(`Template '${formData.name}' updated successfully!`);
        if (res.data) {
          setFormData(res.data);
        }
      } else {
        toast.error(res.message || 'Failed to update template.');
      }
    } catch (err: any) {
      console.error('Error updating template:', err);
      toast.error(err.response?.data?.message || 'Error updating template.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-16 text-center text-slate-600 dark:text-slate-400 dark:text-slate-400 flex flex-col items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mb-3" />
        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Loading email template...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/admin/email/templates"
            className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            title="Back to Templates"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Mail className="w-5 h-5 text-blue-500" />
                {formData.name || 'Edit Email Template'}
              </h1>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {formData.key}
              </span>

            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 dark:text-slate-400 mt-0.5">
              Customize email copy, colors, dynamic variables, and timing with instant live preview.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-2"
          >
            <Eye className="w-4 h-4 text-blue-400" />
            <span>Full Preview</span>
          </button>
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={saving}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors flex items-center gap-2 disabled:opacity-50 shadow-sm"
          >
            <Check className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex items-center gap-2 p-1.5 bg-white dark:bg-[#0a0a0a] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-inner">
        <button
          type="button"
          onClick={() => setActiveMainTab('visual_design')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeMainTab === 'visual_design'
            ? 'bg-blue-600 text-white shadow-sm'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
        >
          <Paintbrush className="w-4 h-4" />
          <span>Visual Designer & Live Preview</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveMainTab('scheduling')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeMainTab === 'scheduling'
            ? 'bg-blue-600 text-white shadow-sm'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
        >
          <Clock className="w-4 h-4" />
          <span>Sequence & Automation Timing</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveMainTab('settings')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeMainTab === 'settings'
            ? 'bg-blue-600 text-white shadow-sm'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
        >
          <Settings className="w-4 h-4" />
          <span>General Settings & Variables</span>
        </button>
      </div>

      {/* Tab 1: Visual Design */}
      {activeMainTab === 'visual_design' && (
        <div className="space-y-6">
          {/* Quick Subject Bar */}
          <div className="bg-white dark:bg-[#0a0a0a] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            <div className="md:col-span-2">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                <span>Subject Line</span> <span className="text-rose-400">*</span>
                <FieldTooltip
                  title="Subject Line"
                  content="The email subject recipient sees in their inbox. Make it clear and compelling."
                />
              </label>
              <input
                type="text"
                required
                value={formData.subject || ''}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                className="w-full bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="e.g. Welcome to Boomerr! Start monitoring in 30 seconds"
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                <span>Category</span>
                <FieldTooltip
                  title="Category"
                  content="High-level category for classifying this template in dashboard views."
                />
              </label>
              <select
                value={formData.category || 'onboarding'}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              >
                <option value="onboarding">Onboarding</option>
                <option value="lifecycle">Lifecycle</option>
                <option value="newsletter">Newsletter</option>
                <option value="transactional">Transactional</option>
                <option value="alert">Alerts</option>
              </select>
            </div>
          </div>

          {/* Embedded Visual Customizer */}
          <VisualEmailCustomizer
            initialHtml={formData.body_html || ''}
            subject={formData.subject || ''}
            onSubjectChange={(val) => setFormData((prev) => ({ ...prev, subject: val }))}
            onChangeHtml={(val) => setFormData((prev) => ({ ...prev, body_html: val }))}
            templateId={id}
            onSaveDatabase={async (newHtml) => {
              if (!id) return false;
              return await emailTemplateApi.updateTemplate(id, { body_html: newHtml });
            }}
            variables={
              formData.variables && formData.variables.length > 0
                ? formData.variables
                : ['firstName', 'unsubscribeUrl']
            }
          />
        </div>
      )}

      {/* Tab 2: Sequence & Scheduling */}
      {activeMainTab === 'scheduling' && (
        <div className="max-w-2xl bg-white dark:bg-[#0a0a0a] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-5">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
              <Clock className="w-5 h-5 text-blue-500" />
              Automation Timing & Sequence Assignment
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 dark:text-slate-400">
              Configure which sequence pipeline executes this email and the dynamic dispatch delay.
            </p>
          </div>

          <div className="space-y-4 pt-2">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                <span>Sequence Pipeline</span>
                <FieldTooltip
                  title="Sequence Pipeline"
                  content="The automated journey pipeline this template belongs to (e.g. onboarding, churn_prevention, value_summary)."
                />
              </label>
              <input
                type="text"
                value={formData.sequence_name || ''}
                onChange={(e) => setFormData({ ...formData, sequence_name: e.target.value })}
                placeholder="e.g. onboarding, churn_prevention, value_summary"
                className="w-full bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  <span>Step Order</span>
                  <FieldTooltip
                    title="Step Order"
                    content="Chronological position of this email in the sequence (1 = first email, 2 = second follow-up, etc.)."
                  />
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.step_order || 1}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      step_order: parseInt(e.target.value) || 1,
                    })
                  }
                  className="w-full bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  <span>Delay Value</span>
                  <FieldTooltip
                    title="Delay Value"
                    content="The numeric amount of time to wait after the trigger event occurs before sending."
                  />
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.delay_value ?? 0}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      delay_value: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  <span>Delay Unit</span>
                  <FieldTooltip
                    title="Delay Unit"
                    content="The time unit applied to the delay value: Hours, Days, Weeks, or Months."
                  />
                </label>
                <select
                  value={formData.delay_unit || 'hours'}
                  onChange={(e) =>
                    setFormData({ ...formData, delay_unit: e.target.value as any })
                  }
                  className="w-full bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                  <option value="weeks">Weeks</option>
                  <option value="months">Months</option>
                </select>
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  <span>Trigger Event</span>
                  <FieldTooltip
                    title="Trigger Event"
                    content="The event that starts the countdown timer for this step (User Signup, First Domain Added, Inactivity, etc.)."
                  />
                </label>
                <select
                  value={formData.trigger_event || 'signup'}
                  onChange={(e) => setFormData({ ...formData, trigger_event: e.target.value })}
                  className="w-full bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="signup">User Signup</option>
                  <option value="first_domain_added">First Domain Added</option>
                  <option value="last_login">Last Login Inactivity</option>
                  <option value="monitor_limit_reached">Monitor Limit Reached</option>
                  <option value="manual">Manual / Campaign</option>
                </select>
              </div>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                <span>Trigger Condition Description</span>
                <FieldTooltip
                  title="Trigger Condition"
                  content="Human-readable rule summary of automation criteria verified before sending."
                />
              </label>
              <input
                type="text"
                value={formData.trigger_condition || ''}
                onChange={(e) => setFormData({ ...formData, trigger_condition: e.target.value })}
                placeholder="e.g. 1 hour after first domain & 0 alert channels connected"
                className="w-full bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => handleSubmit()}
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Timing & Scheduling'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Template Settings & Variables */}
      {activeMainTab === 'settings' && (
        <div className="max-w-2xl bg-white dark:bg-[#0a0a0a] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-5">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
            <Settings className="w-5 h-5 text-blue-500" />
            Template Metadata & Settings
          </h2>

          <div className="space-y-4 pt-2">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                <span>Template Name</span> <span className="text-rose-400">*</span>
                <FieldTooltip
                  title="Template Name"
                  content="The human-friendly display name of this template."
                />
              </label>
              <input
                type="text"
                required
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                <span>Identifier Key</span> <span className="text-rose-400">*</span>
                <FieldTooltip
                  title="Identifier Key"
                  content="A unique, machine-safe key (e.g. onboarding_email_1_welcome) referenced in dispatch jobs."
                />
              </label>
              <input
                type="text"
                disabled
                value={formData.key || ''}
                className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm font-mono text-slate-500 dark:text-slate-400 cursor-not-allowed"
              />
              <span className="text-[10px] text-slate-600 dark:text-slate-400 dark:text-slate-400 mt-1 block">
                The identifier key is permanent and cannot be modified once created.
              </span>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                <span>Internal Description</span>
                <FieldTooltip
                  title="Description"
                  content="Optional notes explaining the purpose of this email for administrators."
                />
              </label>
              <textarea
                rows={2}
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Internal notes about who receives this email and why..."
                className="w-full bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Merge Variables List */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                <span>Dynamic Merge Variables</span>
                <FieldTooltip
                  title="Merge Variables"
                  content="Variables available to be inserted into this template copy."
                />
              </label>
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="text"
                  value={varInput}
                  onChange={(e) => setVarInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddVariable();
                    }
                  }}
                  placeholder="e.g. domainCount, upgradeUrl"
                  className="flex-1 bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={handleAddVariable}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {(formData.variables || []).map((v) => (
                  <span
                    key={v}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20"
                  >
                    <span>{`$${v}`}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveVariable(v)}
                      className="text-slate-600 dark:text-slate-400 dark:text-slate-400 hover:text-rose-400 ml-1"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Active Switch */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-xs font-semibold text-slate-900 dark:text-white uppercase block">
                  Active Status
                </span>
                <span className="text-[11px] text-slate-600 dark:text-slate-400 dark:text-slate-400">
                  When active, automation pipelines will dispatch this template automatically.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Live Preview Modal */}
      <EmailPreviewModal
        modalOpen={previewOpen}
        setModalOpen={setPreviewOpen}
        template={formData}
        draftSubject={formData.subject}
        draftHtml={formData.body_html}
      />
    </div>
  );
};

export default AdminEditEmailTemplate;
