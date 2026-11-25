import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import emailTemplateApi, { type EmailTemplate } from '../../../services/admin/email-templates';
import EmailPreviewModal from '../../../components/admin/email/EmailPreviewModal';
import FieldTooltip from '../../../components/admin/common/FieldTooltip';
import toast from 'react-hot-toast';
import {
  Clock,
  Eye,
  Edit,
  RefreshCw,
  Plus,
  Trash2,
  Sparkles,
  ShieldCheck,
  Zap,
  Check,
  Calendar,
  Sliders,
  AlertTriangle,
  GitBranch,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Mail,
  Send,
  Play,
  X,
} from 'lucide-react';

// Default metadata for known core sequences
const DEFAULT_SEQUENCE_META: Record<
  string,
  { title: string; description: string; icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  onboarding: {
    title: 'Onboarding Sequence',
    description:
      'Nurture journey guiding new users from signup to domain setup, SSL & latency checks, alert channels, and upgrading.',
    icon: Sparkles,
    color: 'indigo',
  },
  value_summary: {
    title: 'Value & Protection Summary',
    description: 'Recaps monitoring uptime benchmarks and protection metrics 2 weeks after initial registration.',
    icon: ShieldCheck,
    color: 'emerald',
  },
  churn_prevention: {
    title: 'Churn Prevention',
    description: 'Inactivity detection campaigns checking in when monitors are active but the user has been away.',
    icon: Clock,
    color: 'amber',
  },
  monitor_limits: {
    title: 'Monitor Limit Alerts',
    description: 'Instant notification when a workspace reaches capacity on domain monitors with direct upgrade CTA.',
    icon: AlertTriangle,
    color: 'rose',
  },
};

const TRIGGER_EVENTS = [
  { id: 'signup', label: 'User Signup / Onboarding Completed' },
  { id: 'first_domain_added', label: 'First Domain Added to Workspace' },
  { id: 'last_login', label: 'Inactivity (Days/Hours Since Last Login)' },
  { id: 'monitor_limit_reached', label: 'Monitor Limit Reached on Workspace' },
  { id: 'manual', label: 'Manual / Custom Dispatch' },
];

const DELAY_UNITS = [
  { id: 'hours', label: 'Hours' },
  { id: 'days', label: 'Days' },
  { id: 'weeks', label: 'Weeks' },
  { id: 'months', label: 'Months' },
];

export const AdminEmailSequence: React.FC = () => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSequenceKey, setActiveSequenceKey] = useState('onboarding');

  // Preview Modal
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);

  // Edit Schedule Modal
  const [editScheduleModalOpen, setEditScheduleModalOpen] = useState(false);
  const [scheduleTemplate, setScheduleTemplate] = useState<EmailTemplate | null>(null);
  const [scheduleFormData, setScheduleFormData] = useState({
    sequence_name: '',
    step_order: 1,
    delay_value: 1,
    delay_unit: 'days' as 'hours' | 'days' | 'weeks' | 'months',
    trigger_event: 'first_domain_added',
    trigger_condition: '',
    is_active: true,
  });
  const [savingSchedule, setSavingSchedule] = useState(false);

  // Add Step / Custom Sequence Modal
  const [addStepModalOpen, setAddStepModalOpen] = useState(false);
  const [newStepData, setNewStepData] = useState({
    sequence_name: 'onboarding',
    custom_sequence_name: '',
    name: '',
    key: '',
    category: 'onboarding',
    step_order: 1,
    delay_value: 1,
    delay_unit: 'hours' as 'hours' | 'days' | 'weeks' | 'months',
    trigger_event: 'first_domain_added',
    trigger_condition: '',
    subject: '',
    body_html: '',
    is_active: true,
  });
  const [savingNewStep, setSavingNewStep] = useState(false);

  // Delete Confirmation Modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [stepToDelete, setStepToDelete] = useState<EmailTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Test Send Modal
  const [testSendModalOpen, setTestSendModalOpen] = useState(false);
  const [testSendTemplate, setTestSendTemplate] = useState<EmailTemplate | null>(null);
  const [testSendEmail, setTestSendEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  // Triggering runner
  const [runningJob, setRunningJob] = useState(false);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await emailTemplateApi.getTemplates();
      if (res.success && Array.isArray(res.data)) {
        setTemplates(res.data);
      }
    } catch (err) {
      console.error('Error fetching templates:', err);
      toast.error('Could not connect to email templates API.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const availableSequences = useMemo(() => {
    const sequenceKeys = new Set(['onboarding', 'value_summary', 'churn_prevention', 'monitor_limits']);
    templates.forEach((t) => {
      if (t.sequence_name) {
        sequenceKeys.add(t.sequence_name);
      }
    });

    return Array.from(sequenceKeys).map((seqKey) => {
      const meta = DEFAULT_SEQUENCE_META[seqKey] || {
        title: seqKey.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) + ' Sequence',
        description: 'Custom automated sequence managed by administrators.',
        icon: GitBranch,
        color: 'blue',
      };
      return {
        key: seqKey,
        ...meta,
      };
    });
  }, [templates]);

  const activeSequenceSteps = useMemo(() => {
    return templates
      .filter((t) => t.sequence_name === activeSequenceKey)
      .sort((a, b) => (a.step_order || 0) - (b.step_order || 0));
  }, [templates, activeSequenceKey]);

  const handleOpenEditSchedule = (template: EmailTemplate) => {
    setScheduleTemplate(template);
    setScheduleFormData({
      sequence_name: template.sequence_name || activeSequenceKey,
      step_order: template.step_order || 1,
      delay_value: template.delay_value !== null && template.delay_value !== undefined ? template.delay_value : 0,
      delay_unit: template.delay_unit || 'hours',
      trigger_event: template.trigger_event || 'signup',
      trigger_condition: template.trigger_condition || '',
      is_active: Boolean(template.is_active),
    });
    setEditScheduleModalOpen(true);
  };

  const handleSaveSchedule = async () => {
    if (!scheduleTemplate) return;
    setSavingSchedule(true);
    try {
      const res = await emailTemplateApi.updateTemplate(scheduleTemplate.id, scheduleFormData);
      if (res.success) {
        toast.success(`Schedule for '${scheduleTemplate.name}' updated!`);
        setTemplates((prev) =>
          prev.map((t) => (t.id === scheduleTemplate.id ? { ...t, ...scheduleFormData } : t))
        );
        setEditScheduleModalOpen(false);
        setScheduleTemplate(null);
      } else {
        toast.error(res.message || 'Failed to update schedule.');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error updating schedule.');
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleCreateStep = async () => {
    const effectiveSeqName =
      newStepData.sequence_name === 'new'
        ? newStepData.custom_sequence_name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_')
        : newStepData.sequence_name;

    if (!effectiveSeqName) {
      toast.error('Please specify a valid sequence pipeline name.');
      return;
    }
    if (!newStepData.name.trim()) {
      toast.error('Please provide a step template name.');
      return;
    }
    if (!newStepData.key.trim()) {
      toast.error('Please provide a unique template key.');
      return;
    }
    if (!newStepData.subject.trim()) {
      toast.error('Please provide an email subject line.');
      return;
    }

    setSavingNewStep(true);
    try {
      const payload = {
        ...newStepData,
        sequence_name: effectiveSeqName,
        body_html:
          newStepData.body_html ||
          `@component('emails.components.layout', ['bodyBg' => '#f1f5f9', 'cardBg' => '#ffffff', 'headerBg' => '#ffffff'])
<div class="email-greeting" style="color: #0f172a; font-size: 18px; font-weight: 700; margin-bottom: 18px;">Hi {{ $firstName ?? 'there' }},</div>
<p style="color: #334155;">${newStepData.subject}</p>
@endcomponent`,
      };

      const res = await emailTemplateApi.createTemplate(payload);
      if (res.success) {
        toast.success(`Step '${newStepData.name}' created!`);
        setTemplates((prev) => [...prev, res.data]);
        setActiveSequenceKey(effectiveSeqName);
        setAddStepModalOpen(false);
        setNewStepData({
          sequence_name: effectiveSeqName,
          custom_sequence_name: '',
          name: '',
          key: '',
          category: 'onboarding',
          step_order: (activeSequenceSteps.length || 0) + 1,
          delay_value: 1,
          delay_unit: 'days',
          trigger_event: 'first_domain_added',
          trigger_condition: '',
          subject: '',
          body_html: '',
          is_active: true,
        });
      } else {
        toast.error(res.message || 'Failed to create step.');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error creating step.');
    } finally {
      setSavingNewStep(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!stepToDelete) return;
    setDeleting(true);
    try {
      await emailTemplateApi.deleteTemplate(stepToDelete.id);
      toast.success(`Step '${stepToDelete.name}' removed.`);
      setTemplates((prev) => prev.filter((t) => t.id !== stepToDelete.id));
      setDeleteModalOpen(false);
      setStepToDelete(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete step.');
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleStepActive = async (tpl: EmailTemplate) => {
    const newStatus = !tpl.is_active;
    setTemplates((prev) => prev.map((t) => (t.id === tpl.id ? { ...t, is_active: newStatus } : t)));
    try {
      await emailTemplateApi.toggleActive(tpl.id, newStatus);
      toast.success(`Step '${tpl.name}' ${newStatus ? 'activated' : 'paused'}.`);
    } catch (err) {
      setTemplates((prev) => prev.map((t) => (t.id === tpl.id ? { ...t, is_active: !newStatus } : t)));
      toast.error('Failed to update step status.');
    }
  };

  const handleOpenTestSend = (template: EmailTemplate) => {
    setTestSendTemplate(template);
    setTestSendEmail('');
    setTestSendModalOpen(true);
  };

  const handleSendTestEmail = async () => {
    if (!testSendTemplate) return;
    setSendingTest(true);
    try {
      const res = await emailTemplateApi.testSend(testSendTemplate.id, testSendEmail.trim() || undefined);
      if (res.success) {
        toast.success(res.message || 'Test email sent successfully!');
        setTestSendModalOpen(false);
      } else {
        toast.error(res.message || 'Failed to send test email.');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error sending test email.');
    } finally {
      setSendingTest(false);
    }
  };

  const handleTriggerRun = async () => {
    setRunningJob(true);
    try {
      const res = await emailTemplateApi.triggerRun();
      if (res.success) {
        toast.success(res.message || 'Sequence automations dispatched!');
      } else {
        toast.error(res.message || 'Failed to run automations.');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error triggering sequence automation.');
    } finally {
      setRunningJob(false);
    }
  };

  const activeMeta =
    availableSequences.find((s) => s.key === activeSequenceKey) || availableSequences[0];

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <GitBranch className="w-6 h-6 text-blue-500" />
            Email Sequences & Automations
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 dark:text-slate-400 mt-1">
            Manage end-to-end drip sequences, interval delays, trigger criteria, and automated delivery schedules.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={runningJob}
            onClick={handleTriggerRun}
            className="px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-2 disabled:opacity-50"
            title="Execute sequence evaluation job across active users"
          >
            {runningJob ? (
              <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
            ) : (
              <Play className="w-4 h-4 text-emerald-500 fill-emerald-500" />
            )}
            <span>Run Automations</span>
          </button>
          <Link
            to="/admin/email/templates"
            className="px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-2"
          >
            <Mail className="w-4 h-4 text-blue-400" />
            <span>All Templates</span>
          </Link>
          <button
            type="button"
            onClick={() => {
              setNewStepData((prev) => ({
                ...prev,
                sequence_name: activeSequenceKey,
                step_order: activeSequenceSteps.length + 1,
              }));
              setAddStepModalOpen(true);
            }}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Add Step to Sequence</span>
          </button>
        </div>
      </div>

      {/* Sequence Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-white dark:bg-[#0a0a0a] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-inner">
        {availableSequences.map((seq) => {
          const count = templates.filter((t) => t.sequence_name === seq.key).length;
          const isActive = activeSequenceKey === seq.key;
          const Icon = seq.icon;
          return (
            <button
              key={seq.key}
              type="button"
              onClick={() => setActiveSequenceKey(seq.key)}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${isActive
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
            >
              <Icon className="w-4 h-4" />
              <span>{seq.title}</span>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-mono ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-400'
                  }`}
              >
                {count} {count === 1 ? 'step' : 'steps'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Sequence Overview Banner */}
      {activeMeta && (
        <div className="bg-white dark:bg-[#0a0a0a] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
              <activeMeta.icon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">{activeMeta.title}</h2>
                <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {activeMeta.key}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 dark:text-slate-400 mt-1 max-w-3xl leading-relaxed">
                {activeMeta.description}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-800 pt-3 md:pt-0 md:pl-6 shrink-0 text-xs">
            <div>
              <span className="text-slate-600 dark:text-slate-400 dark:text-slate-400 block">Total Journey Steps</span>
              <span className="text-lg font-bold text-slate-900 dark:text-white font-mono">
                {activeSequenceSteps.length}
              </span>
            </div>
            <div>
              <span className="text-slate-600 dark:text-slate-400 dark:text-slate-400 block">Active Steps</span>
              <span className="text-lg font-bold text-emerald-400 font-mono">
                {activeSequenceSteps.filter((s) => s.is_active).length}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Sequence Timeline Steps */}
      {loading ? (
        <div className="p-16 text-center text-slate-600 dark:text-slate-400 dark:text-slate-400 flex flex-col items-center justify-center">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-500 mb-2" />
          <span className="text-xs">Loading sequence pipeline...</span>
        </div>
      ) : activeSequenceSteps.length === 0 ? (
        <div className="bg-white dark:bg-[#0a0a0a] rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-16 text-center text-slate-600 dark:text-slate-400 dark:text-slate-400 flex flex-col items-center justify-center space-y-3">
          <GitBranch className="w-10 h-10 text-slate-700" />
          <div>
            <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300">No steps assigned to this sequence yet</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 dark:text-slate-400 mt-1">
              Add your first automated email step or assign existing templates to '{activeSequenceKey}'.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setNewStepData((prev) => ({
                ...prev,
                sequence_name: activeSequenceKey,
                step_order: 1,
              }));
              setAddStepModalOpen(true);
            }}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-slate-900 dark:text-white transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Step 1</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {activeSequenceSteps.map((step, idx) => (
            <div
              key={step.id}
              className="bg-white dark:bg-[#0a0a0a] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:border-slate-300 dark:border-slate-700 transition-all group"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Left: Step Order Badge & Details */}
                <div className="flex items-start gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-mono font-bold text-sm shrink-0">
                    #{step.step_order || idx + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/admin/email/templates/${step.id}/edit`}
                        className="font-bold text-sm text-slate-900 dark:text-white hover:text-blue-400 transition-colors truncate"
                      >
                        {step.name}
                      </Link>
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {step.key}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-400 truncate mt-1">
                      Subject: <span className="font-medium text-slate-900 dark:text-slate-200">{step.subject}</span>
                    </p>

                    {/* Delay & Trigger Badges */}
                    <div className="flex flex-wrap items-center gap-2 mt-2.5">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                        <Clock className="w-3 h-3 text-blue-400" />
                        <span>
                          Delay:{' '}
                          <strong className="text-slate-900 dark:text-white">
                            {step.delay_value ?? 0} {step.delay_unit || 'hours'}
                          </strong>
                        </span>
                      </span>

                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                        <Zap className="w-3 h-3 text-amber-400" />
                        <span>
                          Trigger:{' '}
                          <strong className="text-slate-900 dark:text-white">{step.trigger_event || 'signup'}</strong>
                        </span>
                      </span>

                      {step.trigger_condition && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                          <span>Condition: {step.trigger_condition}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Status Switch & Action Buttons */}
                <div className="flex items-center gap-2 shrink-0 border-t lg:border-t-0 border-slate-200 dark:border-slate-800 pt-3 lg:pt-0">
                  {/* Status Toggle */}
                  <button
                    type="button"
                    onClick={() => handleToggleStepActive(step)}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${step.is_active
                      ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/20'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                      }`}
                  >
                    {step.is_active ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Active</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Paused</span>
                      </>
                    )}
                  </button>

                  {/* Schedule Modal Trigger */}
                  <button
                    type="button"
                    onClick={() => handleOpenEditSchedule(step)}
                    className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                    title="Edit Schedule & Delays"
                  >
                    <Sliders className="w-4 h-4" />
                  </button>

                  {/* Live Preview Trigger */}
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewTemplate(step);
                      setPreviewOpen(true);
                    }}
                    className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                    title="Live Preview"
                  >
                    <Eye className="w-4 h-4" />
                  </button>

                  {/* Send Test Email */}
                  <button
                    type="button"
                    onClick={() => handleOpenTestSend(step)}
                    className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-amber-500 dark:hover:text-amber-400 transition-colors"
                    title="Send Test Email"
                  >
                    <Send className="w-4 h-4" />
                  </button>

                  {/* Edit Template */}
                  <Link
                    to={`/admin/email/templates/${step.id}/edit`}
                    className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors"
                    title="Customize Email Copy & Design"
                  >
                    <Edit className="w-4 h-4" />
                  </Link>

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => {
                      setStepToDelete(step);
                      setDeleteModalOpen(true);
                    }}
                    className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-rose-500 dark:hover:text-rose-400 transition-colors"
                    title="Remove Step"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Schedule Modal */}
      {editScheduleModalOpen && scheduleTemplate && (
        <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-3 sm:p-6">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => setEditScheduleModalOpen(false)}
          />
          <div className="relative z-10 bg-white dark:bg-[#0a0a0a] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 max-w-lg w-full space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-blue-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Edit Automation Schedule
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditScheduleModalOpen(false)}
                className="text-slate-600 dark:text-slate-400 dark:text-slate-400 hover:text-slate-900 dark:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  Template Name
                </label>
                <input
                  type="text"
                  disabled
                  value={scheduleTemplate.name}
                  className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-500 dark:text-slate-400 cursor-not-allowed"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    <span>Step Order</span>
                    <FieldTooltip
                      title="Step Order"
                      content="The chronological step index in this sequence pipeline."
                    />
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={scheduleFormData.step_order}
                    onChange={(e) =>
                      setScheduleFormData({
                        ...scheduleFormData,
                        step_order: parseInt(e.target.value) || 1,
                      })
                    }
                    className="w-full bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    <span>Delay Value</span>
                    <FieldTooltip
                      title="Delay Value"
                      content="Numeric amount of time to wait after the trigger event."
                    />
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={scheduleFormData.delay_value}
                    onChange={(e) =>
                      setScheduleFormData({
                        ...scheduleFormData,
                        delay_value: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    <span>Delay Unit</span>
                    <FieldTooltip
                      title="Delay Unit"
                      content="Time unit applied to delay: Hours, Days, Weeks, or Months."
                    />
                  </label>
                  <select
                    value={scheduleFormData.delay_unit}
                    onChange={(e) =>
                      setScheduleFormData({
                        ...scheduleFormData,
                        delay_unit: e.target.value as any,
                      })
                    }
                    className="w-full bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  >
                    {DELAY_UNITS.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    <span>Trigger Event</span>
                    <FieldTooltip
                      title="Trigger Event"
                      content="Event that initiates countdown dispatch."
                    />
                  </label>
                  <select
                    value={scheduleFormData.trigger_event}
                    onChange={(e) =>
                      setScheduleFormData({
                        ...scheduleFormData,
                        trigger_event: e.target.value,
                      })
                    }
                    className="w-full bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  >
                    {TRIGGER_EVENTS.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  <span>Trigger Condition Description</span>
                  <FieldTooltip
                    title="Trigger Condition"
                    content="Human-readable summary of criteria verified before dispatch."
                  />
                </label>
                <input
                  type="text"
                  value={scheduleFormData.trigger_condition}
                  onChange={(e) =>
                    setScheduleFormData({
                      ...scheduleFormData,
                      trigger_condition: e.target.value,
                    })
                  }
                  placeholder="e.g. 1 hour after first domain & 0 alert channels connected"
                  className="w-full bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
                <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">Active Delivery Status</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={scheduleFormData.is_active}
                    onChange={(e) =>
                      setScheduleFormData({
                        ...scheduleFormData,
                        is_active: e.target.checked,
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setEditScheduleModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingSchedule}
                onClick={handleSaveSchedule}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors disabled:opacity-50"
              >
                {savingSchedule ? 'Saving...' : 'Save Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Step Modal */}
      {addStepModalOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-3 sm:p-6">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => setAddStepModalOpen(false)}
          />
          <div className="relative z-10 bg-white dark:bg-[#0a0a0a] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 max-w-lg w-full space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Add Step to Sequence</h3>
              </div>
              <button
                type="button"
                onClick={() => setAddStepModalOpen(false)}
                className="text-slate-600 dark:text-slate-400 dark:text-slate-400 hover:text-slate-900 dark:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  Target Pipeline
                </label>
                <select
                  value={newStepData.sequence_name}
                  onChange={(e) =>
                    setNewStepData({ ...newStepData, sequence_name: e.target.value })
                  }
                  className="w-full bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                >
                  {availableSequences.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.title} ({s.key})
                    </option>
                  ))}
                  <option value="new">+ Create New Pipeline...</option>
                </select>
              </div>

              {newStepData.sequence_name === 'new' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    New Pipeline Name
                  </label>
                  <input
                    type="text"
                    value={newStepData.custom_sequence_name}
                    onChange={(e) =>
                      setNewStepData({
                        ...newStepData,
                        custom_sequence_name: e.target.value,
                      })
                    }
                    placeholder="e.g. re-engagement_campaign"
                    className="w-full bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  Step Template Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newStepData.name}
                  onChange={(e) => {
                    const nameVal = e.target.value;
                    const slug = nameVal.toLowerCase().replace(/[^a-z0-9_]/g, '_');
                    setNewStepData({ ...newStepData, name: nameVal, key: slug });
                  }}
                  placeholder="e.g. Connect Alert Channels Prompt"
                  className="w-full bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  Identifier Key <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newStepData.key}
                  onChange={(e) =>
                    setNewStepData({
                      ...newStepData,
                      key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
                    })
                  }
                  placeholder="e.g. onboarding_email_3_alerts"
                  className="w-full bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  Subject Line <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newStepData.subject}
                  onChange={(e) =>
                    setNewStepData({ ...newStepData, subject: e.target.value })
                  }
                  placeholder="e.g. Receive alerts in Slack or Discord instantly"
                  className="w-full bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    Step Order
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newStepData.step_order}
                    onChange={(e) =>
                      setNewStepData({
                        ...newStepData,
                        step_order: parseInt(e.target.value) || 1,
                      })
                    }
                    className="w-full bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    Delay
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="0"
                      value={newStepData.delay_value}
                      onChange={(e) =>
                        setNewStepData({
                          ...newStepData,
                          delay_value: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-20 bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                    />
                    <select
                      value={newStepData.delay_unit}
                      onChange={(e) =>
                        setNewStepData({
                          ...newStepData,
                          delay_unit: e.target.value as any,
                        })
                      }
                      className="flex-1 bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                    >
                      {DELAY_UNITS.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setAddStepModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingNewStep}
                onClick={handleCreateStep}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors disabled:opacity-50"
              >
                {savingNewStep ? 'Creating...' : 'Create Step'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteModalOpen && stepToDelete && (
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
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Delete Step from Sequence?</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 dark:text-slate-400 mt-1">
                Are you sure you want to delete{' '}
                <strong className="text-slate-200">"{stepToDelete.name}"</strong> from sequence{' '}
                <strong className="text-slate-200 font-mono">'{activeSequenceKey}'</strong>?
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

      {/* Test Send Modal */}
      {testSendModalOpen && testSendTemplate && (
        <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-3 sm:p-6">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => setTestSendModalOpen(false)}
          />
          <div className="relative z-10 bg-white dark:bg-[#0a0a0a] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Send Test Email</h3>
              </div>
              <button
                type="button"
                onClick={() => setTestSendModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400">
              Send a rendered test email for step <strong>'{testSendTemplate.name}'</strong> to verify dynamic Blade rendering, variables, and styling.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                Recipient Email
              </label>
              <input
                type="email"
                placeholder="Leave blank to use admin default email"
                value={testSendEmail}
                onChange={(e) => setTestSendEmail(e.target.value)}
                className="w-full bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setTestSendModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={sendingTest}
                onClick={handleSendTestEmail}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-xs font-semibold text-white transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {sendingTest ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>{sendingTest ? 'Sending...' : 'Send Test'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Preview Modal */}
      <EmailPreviewModal
        modalOpen={previewOpen}
        setModalOpen={setPreviewOpen}
        template={previewTemplate}
      />
    </div>
  );
};

export default AdminEmailSequence;
