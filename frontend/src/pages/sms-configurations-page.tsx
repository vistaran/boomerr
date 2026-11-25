import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { ArrowLeft, Plus, Pencil, Trash2, Send, MessageSquare, AlertTriangle, Zap } from "lucide-react";
import {
    getSmsConfigurationsWithCredits,
    createSmsConfiguration,
    updateSmsConfiguration,
    deleteSmsConfiguration,
    testSmsConfiguration,
    type SmsConfiguration,
    type SmsConfigurationPayload,
    type SmsCreditDetails,
} from "../services/integrations-service";
import { ToggleSwitch } from "../components/common/toggle";
import CommonLoader from "../components/common/common-loader";
import { useRuntimeConfig } from "../hooks/use-runtime-config";

/* ============================================================
 * Modal – Add / Edit an SMS configuration
 * ============================================================ */
const DEFAULT_FORM: SmsConfigurationPayload = {
    name: "",
    sms_enabled: true,
    phone_number: "",
    down_threshold: 3,
    ssl_days_before: 7,
};

type ModalProps = {
    initial?: SmsConfiguration | null;
    onClose: () => void;
    onSaved: (config: SmsConfiguration) => void;
};

function SmsConfigModal({ initial, onClose, onSaved }: ModalProps) {
    const [form, setForm] = useState<SmsConfigurationPayload>(
        initial
            ? {
                name: initial.name,
                sms_enabled: initial.sms_enabled,
                phone_number: initial.phone_number ?? "",
                down_threshold: initial.down_threshold,
                ssl_days_before: initial.ssl_days_before,
            }
            : DEFAULT_FORM
    );
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const newErrors: Record<string, string> = {};
        if (!form.name.trim()) newErrors.name = "Name is required";
        if (!form.phone_number.trim()) newErrors.phone_number = "Recipient Phone Number is required";

        setErrors(newErrors);

        if (Object.keys(newErrors).length > 0) return;
        setSaving(true);
        try {
            const saved = initial
                ? await updateSmsConfiguration(initial.id, form)
                : await createSmsConfiguration(form);
            toast.success(initial ? "Configuration updated." : "Configuration created.");
            onSaved(saved);
        } catch {
            toast.error("Failed to save configuration.");
        } finally {
            setSaving(false);
        }
    };

    const set = <K extends keyof SmsConfigurationPayload>(key: K, value: SmsConfigurationPayload[K]) =>
        setForm(prev => ({ ...prev, [key]: value }));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
                <h3 className="text-base font-semibold text-slate-100 mb-5">
                    {initial ? "Edit SMS Configuration" : "Add SMS Configuration"}
                </h3>

                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                    {/* Name */}
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Name <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            value={form.name}
                            onChange={e => { set("name", e.target.value); if (errors.name) setErrors({ ...errors, name: '' }); }}
                            placeholder="e.g. On-call alerts"
                            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                        />
                        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                    </div>

                    {/* Phone number */}
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Recipient Phone Number <span className="text-red-500">*</span></label>
                        <input
                            type="tel"
                            value={form.phone_number}
                            onChange={e => { set("phone_number", e.target.value); if (errors.phone_number) setErrors({ ...errors, phone_number: '' }); }}
                            placeholder="+1234567890"
                            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                        />
                        {errors.phone_number && <p className="text-red-500 text-xs mt-1">{errors.phone_number}</p>}
                        <p className="mt-1 text-xs text-slate-500">Include country code (e.g. +1).</p>
                    </div>

                    {/* Thresholds */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1">Down threshold</label>
                            <input
                                type="number"
                                min={1}
                                max={100}
                                value={form.down_threshold}
                                onChange={e => set("down_threshold", Number(e.target.value))}
                                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
                            />
                            <p className="mt-1 text-xs text-slate-500">Failures before SMS is sent.</p>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1">SSL alert days</label>
                            <input
                                type="number"
                                min={1}
                                max={90}
                                value={form.ssl_days_before}
                                onChange={e => set("ssl_days_before", Number(e.target.value))}
                                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
                            />
                            <p className="mt-1 text-xs text-slate-500">Days before SSL expiry.</p>
                        </div>
                    </div>

                    {/* Enabled toggle */}
                    <div className="flex items-center justify-between pt-1">
                        <span className="text-sm text-slate-300">Enable SMS alerts</span>
                        <ToggleSwitch
                            checked={form.sms_enabled}
                            onChange={v => set("sms_enabled", v)}
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50 transition-colors"
                        >
                            {saving ? "Saving…" : initial ? "Save Changes" : "Create"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

/* ============================================================
 * Config card
 * ============================================================ */
type CardProps = {
    config: SmsConfiguration;
    onEdit: (config: SmsConfiguration) => void;
    onDelete: (config: SmsConfiguration) => void;
    onTest: (config: SmsConfiguration) => void;
    testingId: number | null;
    hasCredits: boolean;
};

function SmsConfigCard({ config, onEdit, onDelete, onTest, testingId, hasCredits }: CardProps) {
    const isTesting = testingId === config.id;
    const canTest = hasCredits && !isTesting && Boolean(config.phone_number);

    return (
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 flex flex-col gap-3 hover:border-slate-600 transition-all">
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <MessageSquare className="w-4 h-4 text-sky-400 shrink-0" />
                    <span className="text-sm font-medium text-slate-100 truncate">{config.name}</span>
                </div>
                <span
                    className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${config.sms_enabled
                        ? "bg-green-900/50 text-green-400"
                        : "bg-slate-800 text-slate-400"
                        }`}
                >
                    {config.sms_enabled ? "Active" : "Disabled"}
                </span>
            </div>

            <div className="space-y-1 text-xs text-slate-400">
                <div className="flex justify-between">
                    <span>Phone</span>
                    <span className="text-slate-200 font-mono">{config.phone_number ?? "-"}</span>
                </div>
                <div className="flex justify-between">
                    <span>Down threshold</span>
                    <span className="text-slate-200">{config.down_threshold} failure{config.down_threshold !== 1 ? "s" : ""}</span>
                </div>
                <div className="flex justify-between">
                    <span>SSL alert</span>
                    <span className="text-slate-200">{config.ssl_days_before} day{config.ssl_days_before !== 1 ? "s" : ""} before</span>
                </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
                <button
                    onClick={() => onTest(config)}
                    disabled={!canTest}
                    title={!hasCredits ? "Monthly SMS credit limit reached" : "Send test SMS"}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-sky-400 bg-sky-900/30 hover:bg-sky-900/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                    <Send className="w-3 h-3" />
                    {isTesting ? "Sending…" : "Test"}
                </button>
                <button
                    onClick={() => onEdit(config)}
                    title="Edit"
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                    <Pencil className="w-3 h-3" />
                    Edit
                </button>
                <button
                    onClick={() => onDelete(config)}
                    title="Delete"
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-red-400 bg-red-900/20 hover:bg-red-900/40 transition-colors"
                >
                    <Trash2 className="w-3 h-3" />
                    Delete
                </button>
            </div>
        </div>
    );
}

/* ============================================================
 * Page
 * ============================================================ */
export default function SmsConfigurationsPage() {
    const { billingEnabled } = useRuntimeConfig();
    const navigate = useNavigate();
    const [configs, setConfigs] = useState<SmsConfiguration[]>([]);
    const [credits, setCredits] = useState<SmsCreditDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<SmsConfiguration | null>(null);
    const [testingId, setTestingId] = useState<number | null>(null);

    const fetchConfigs = async () => {
        setLoading(true);
        try {
            const data = await getSmsConfigurationsWithCredits();
            setConfigs(data.data);
            setCredits(data.credits);
        } catch {
            toast.error("Failed to load SMS configurations.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchConfigs();
    }, []);

    const handleSaved = (saved: SmsConfiguration) => {
        setConfigs(prev => {
            const exists = prev.find(c => c.id === saved.id);
            return exists ? prev.map(c => (c.id === saved.id ? saved : c)) : [saved, ...prev];
        });
        setShowModal(false);
        setEditing(null);
    };

    const handleEdit = (config: SmsConfiguration) => {
        setEditing(config);
        setShowModal(true);
    };

    const handleDelete = async (config: SmsConfiguration) => {
        if (!confirm(`Delete "${config.name}"? This cannot be undone.`)) return;
        try {
            await deleteSmsConfiguration(config.id);
            setConfigs(prev => prev.filter(c => c.id !== config.id));
            toast.success("Configuration deleted.");
        } catch {
            toast.error("Failed to delete configuration.");
        }
    };

    const handleTest = async (config: SmsConfiguration) => {
        if (credits && credits.limit !== null && credits.remaining !== null && credits.remaining <= 0) {
            toast.error("Monthly SMS credit limit reached (0 remaining). Upgrade your plan for more credits.");
            return;
        }

        setTestingId(config.id);
        try {
            const res = await testSmsConfiguration(config.id);
            toast.success(res.message);
            setCredits(prev => {
                if (!prev) return null;
                const newUsed = prev.used + 1;
                const newRemaining = prev.limit !== null ? Math.max(0, prev.limit - newUsed) : null;
                return {
                    ...prev,
                    used: newUsed,
                    remaining: newRemaining,
                    has_credit: newRemaining === null || newRemaining > 0,
                };
            });
        } catch {
            toast.error("Failed to send test SMS.");
        } finally {
            setTestingId(null);
        }
    };

    const hasCredits = credits?.has_credit ?? true;

    return (
        <div className="min-h-screen bg-slate-950 px-4 py-8 md:px-8">
            {/* Header */}
            <div className="max-w-4xl mx-auto mb-8">
                <button
                    onClick={() => navigate("/settings")}
                    className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors mb-6"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Settings
                </button>

                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h1 className="text-xl font-bold text-slate-100">SMS Alert Configurations</h1>
                        <p className="text-sm text-slate-400 mt-1">
                            Manage phone numbers and thresholds for SMS domain alerts in this workspace.
                        </p>
                    </div>

                    <button
                        onClick={() => { setEditing(null); setShowModal(true); }}
                        className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 transition-colors shrink-0"
                    >
                        <Plus className="w-4 h-4" />
                        Add Configuration
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-4xl mx-auto">
                {/* Credit usage banner (Only displayed for plans with a credit limit, e.g. Free plan) */}
                {billingEnabled && credits && credits.limit !== null && (
                    <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-sm">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div className="flex items-start gap-3">
                                <div className={`p-2.5 rounded-lg shrink-0 ${
                                    credits.remaining !== null && credits.remaining <= 0
                                        ? "bg-red-500/10 text-red-400 border border-red-500/20"
                                        : "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                                }`}>
                                    {credits.remaining !== null && credits.remaining <= 0 ? (
                                        <AlertTriangle className="w-5 h-5" />
                                    ) : (
                                        <Zap className="w-5 h-5" />
                                    )}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-sm font-semibold text-slate-100">
                                            Monthly SMS Credits
                                        </h2>
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                                            1 credit = 1 SMS
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        <strong className="text-slate-200">{credits.used}</strong> of{" "}
                                        <strong className="text-slate-200">{credits.limit}</strong> credits used this month ({credits.remaining} remaining). Resets on the 1st of next month.
                                    </p>
                                </div>
                            </div>

                            {credits.limit !== null && credits.remaining !== null && credits.remaining <= 0 && (
                                <button
                                    onClick={() => navigate("/billing")}
                                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-amber-600 hover:bg-amber-500 rounded-lg transition-colors shrink-0"
                                >
                                    Upgrade Plan
                                </button>
                            )}
                        </div>

                        {credits.limit !== null && (
                            <div className="mt-4">
                                <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-300 ${
                                            credits.remaining !== null && credits.remaining <= 0
                                                ? "bg-red-500"
                                                : credits.used / credits.limit > 0.8
                                                ? "bg-amber-500"
                                                : "bg-sky-500"
                                        }`}
                                        style={{
                                            width: `${Math.min(100, Math.round((credits.used / credits.limit) * 100))}%`,
                                        }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {loading ? (
                    <div className="flex items-center justify-center gap-3 py-16 text-slate-400">
                        <CommonLoader />
                        Loading configurations…
                    </div>
                ) : configs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-500">
                        <MessageSquare className="w-10 h-10 opacity-30" />
                        <p className="text-sm">No SMS configurations yet.</p>
                        <button
                            onClick={() => { setEditing(null); setShowModal(true); }}
                            className="mt-2 text-sky-400 text-sm hover:underline"
                        >
                            Add your first configuration
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {configs.map(config => (
                            <SmsConfigCard
                                key={config.id}
                                config={config}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                                onTest={handleTest}
                                testingId={testingId}
                                hasCredits={hasCredits}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <SmsConfigModal
                    initial={editing}
                    onClose={() => { setShowModal(false); setEditing(null); }}
                    onSaved={handleSaved}
                />
            )}
        </div>
    );
}
