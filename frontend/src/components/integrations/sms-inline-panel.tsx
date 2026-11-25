import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { Plus, Pencil, Trash2, Send, MessageSquare, Loader2, X, ShieldCheck, RotateCw, Zap, AlertTriangle } from "lucide-react";
import {
    getSmsConfigurationsWithCredits,
    updateSmsConfiguration,
    deleteSmsConfiguration,
    testSmsConfiguration,
    sendSmsOtp,
    verifySmsOtp,
    resendSmsOtp,
    type SmsConfiguration,
    type SmsCreditDetails,
} from "../../services/integrations-service";
import { ToggleSwitch } from "../common/toggle";
import { usePlanLimits } from "../../hooks/use-plan-limits";

/* ── modal form type (sms_enabled is controlled by the row toggle, not the modal) ── */
type ModalForm = {
    name: string;
    phone_number: string;
    down_threshold: number;
    ssl_days_before: number;
    events: string[];
};

/* ── default form values ───────────────────────────── */
const DEFAULTS: ModalForm = {
    name: "",
    phone_number: "",
    down_threshold: 3,
    ssl_days_before: 7,
    events: ['Domain Up', 'Domain Down', 'SSL Expiring', 'SSL Expired'],
};

/* ── modal ─────────────────────────────────────────── */
type ModalProps = {
    initial?: SmsConfiguration | null;
    onClose: () => void;
    onSaved: (c: SmsConfiguration) => void;
    domainId?: string | number | null;
};

function SmsConfigModal({ initial, onClose, onSaved, domainId }: ModalProps) {
    const [form, setForm] = useState<ModalForm>(
        initial
            ? {
                name: initial.name,
                phone_number: initial.phone_number ?? "",
                down_threshold: initial.down_threshold,
                ssl_days_before: initial.ssl_days_before,
                events: initial.events ?? ['Domain Up', 'Domain Down', 'SSL Expiring', 'SSL Expired'],
            }
            : DEFAULTS
    );
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    /* OTP state (only used for new configs) */
    const [otpStep, setOtpStep] = useState(false);
    const [otpId, setOtpId] = useState<number | null>(null);
    const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
    const [verifying, setVerifying] = useState(false);
    const [resending, setResending] = useState(false);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    const set = <K extends keyof ModalForm>(k: K, v: ModalForm[K]) =>
        setForm(p => ({ ...p, [k]: v }));

    /* Handle digit input for OTP fields */
    const handleOtpChange = (index: number, value: string) => {
        if (!/^\d*$/.test(value)) return;
        const newDigits = [...otpDigits];
        newDigits[index] = value.slice(-1);
        setOtpDigits(newDigits);
        if (value && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handleOtpPaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
        const newDigits = [...otpDigits];
        for (let i = 0; i < 6; i++) {
            newDigits[i] = pasted[i] || "";
        }
        setOtpDigits(newDigits);
        const focusIdx = Math.min(pasted.length, 5);
        inputRefs.current[focusIdx]?.focus();
    };

    const otpCode = otpDigits.join("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const newErrors: Record<string, string> = {};
        if (!form.name.trim()) newErrors.name = "Name is required";
        if (!form.phone_number.trim()) newErrors.phone_number = "Recipient Phone Number is required";

        setErrors(newErrors);

        if (Object.keys(newErrors).length > 0) return;

        setSaving(true);
        try {
            if (initial) {
                // Edit mode - no OTP needed
                const saved = await updateSmsConfiguration(initial.id, form);
                toast.success("Configuration updated.");
                onSaved(saved);
            } else {
                // New config - send OTP first
                const payload = {
                    ...form,
                    sms_enabled: true,
                    domain_id: domainId != null ? Number(domainId) : null,
                };
                const result = await sendSmsOtp(payload);
                setOtpId(result.otp_id);
                setOtpStep(true);
                toast.success(`Verification code sent to ${form.phone_number}`);
            }
        } catch {
            toast.error(initial ? "Failed to save configuration." : "Failed to send verification code.");
        } finally {
            setSaving(false);
        }
    };

    const handleVerify = async () => {
        if (!otpId || otpCode.length !== 6) return;
        setVerifying(true);
        try {
            const result = await verifySmsOtp(otpId, otpCode);
            toast.success("Phone number verified. Configuration created.");
            onSaved(result.data);
        } catch {
            toast.error("Invalid or expired verification code.");
            setOtpDigits(["", "", "", "", "", ""]);
            inputRefs.current[0]?.focus();
        } finally {
            setVerifying(false);
        }
    };

    const handleResend = async () => {
        if (!otpId) return;
        setResending(true);
        try {
            const result = await resendSmsOtp(otpId);
            setOtpId(result.otp_id);
            setOtpDigits(["", "", "", "", "", ""]);
            inputRefs.current[0]?.focus();
            toast.success("New verification code sent.");
        } catch {
            toast.error("Failed to resend code.");
        } finally {
            setResending(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-base font-semibold text-slate-100">
                        {otpStep
                            ? "Verify Phone Number"
                            : initial
                                ? "Edit SMS Configuration"
                                : "Add SMS Configuration"}
                    </h3>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {otpStep ? (
                    /* ── OTP Verification Step ── */
                    <div className="space-y-5">
                        <div className="flex items-center gap-3 rounded-lg bg-sky-950/40 border border-sky-800/40 px-4 py-3">
                            <ShieldCheck className="w-5 h-5 text-sky-400 shrink-0" />
                            <p className="text-sm text-slate-300">
                                We sent a 6-digit code to <span className="font-mono text-sky-300">{form.phone_number}</span>. Enter it below to verify.
                            </p>
                        </div>

                        <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
                            {otpDigits.map((digit, i) => (
                                <input
                                    key={i}
                                    ref={el => { inputRefs.current[i] = el; }}
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={1}
                                    value={digit}
                                    onChange={e => handleOtpChange(i, e.target.value)}
                                    onKeyDown={e => handleOtpKeyDown(i, e)}
                                    className="w-11 h-12 rounded-lg border border-slate-600 bg-slate-800 text-center text-lg font-semibold text-slate-100 focus:border-sky-500 focus:outline-none transition-colors"
                                />
                            ))}
                        </div>

                        <div className="flex justify-between items-center">
                            <button
                                onClick={handleResend}
                                disabled={resending}
                                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-sky-400 disabled:opacity-50 transition-colors"
                            >
                                <RotateCw className={`w-3.5 h-3.5 ${resending ? "animate-spin" : ""}`} />
                                {resending ? "Resending…" : "Resend code"}
                            </button>
                            <p className="text-xs text-slate-500">Code expires in 10 minutes</p>
                        </div>

                        <div className="flex justify-end gap-3 pt-1">
                            <button
                                type="button"
                                onClick={() => { setOtpStep(false); setOtpDigits(["", "", "", "", "", ""]); }}
                                className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 transition-colors"
                            >
                                Back
                            </button>
                            <button
                                onClick={handleVerify}
                                disabled={verifying || otpCode.length !== 6}
                                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50 transition-colors"
                            >
                                {verifying ? "Verifying…" : "Verify & Create"}
                            </button>
                        </div>
                    </div>
                ) : (
                    /* ── Configuration Form Step ── */
                    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
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
                            <p className="mt-1 text-xs text-slate-500">Include country code (e.g. +1). A verification code will be sent.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Down threshold</label>
                                <input
                                    type="number" min={1} max={100}
                                    value={form.down_threshold}
                                    onChange={e => set("down_threshold", Number(e.target.value))}
                                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
                                />
                                <p className="mt-1 text-xs text-slate-500">Failures before alert.</p>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">SSL alert days</label>
                                <input
                                    type="number"
                                    value={form.ssl_days_before}
                                    onChange={(e) => set("ssl_days_before", parseInt(e.target.value) || 0)}
                                    className="w-full rounded-xl border border-slate-700 bg-slate-900/50 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-300">
                                Event Selection
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {['Domain Up', 'Domain Down', 'SSL Expiring', 'SSL Expired'].map(eventName => (
                                    <label key={eventName} className="flex items-center gap-3 p-3 rounded-lg border border-slate-700/50 bg-slate-900/50 hover:bg-slate-800/50 hover:border-slate-600 cursor-pointer transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={form.events?.includes(eventName)}
                                            onChange={() => {
                                                const events = form.events || [];
                                                if (events.includes(eventName)) {
                                                    set("events", events.filter(e => e !== eventName));
                                                } else {
                                                    set("events", [...events, eventName]);
                                                }
                                            }}
                                            className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-sky-500 focus:ring-sky-500 focus:ring-offset-slate-900"
                                        />
                                        <span className="text-sm text-slate-300">{eventName}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                type="button" onClick={onClose}
                                className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit" disabled={saving}
                                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50 transition-colors"
                            >
                                {saving
                                    ? "Sending…"
                                    : initial
                                        ? "Save Changes"
                                        : "Send Verification Code"}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

/* ── inline panel ──────────────────────────────────── */
type Props = { canManage: boolean; domainId?: string | number | null; onHistory?: (id: number, name: string) => void };

export function SmsInlinePanel({ canManage, domainId, onHistory }: Props) {
    const [configs, setConfigs] = useState<SmsConfiguration[]>([]);
    const [credits, setCredits] = useState<SmsCreditDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<SmsConfiguration | null>(null);
    const [testingId, setTestingId] = useState<number | null>(null);
    const navigate = useNavigate();
    const { hasIntegration } = usePlanLimits();
    const isSmsAllowed = hasIntegration('sms');
    const hasCredits = credits?.has_credit ?? true;

    useEffect(() => {
        if (!isSmsAllowed) {
            setLoading(false);
            return;
        }
        setLoading(true);
        getSmsConfigurationsWithCredits(domainId)
            .then(res => {
                setConfigs(res.data);
                setCredits(res.credits);
            })
            .catch(() => toast.error("Failed to load SMS configurations."))
            .finally(() => setLoading(false));
    }, [domainId, isSmsAllowed]);

    const openAdd = () => { setEditing(null); setShowModal(true); };
    const openEdit = (c: SmsConfiguration) => { setEditing(c); setShowModal(true); };

    const handleSaved = (saved: SmsConfiguration) => {
        setConfigs(prev => {
            const exists = prev.find(c => c.id === saved.id);
            return exists ? prev.map(c => (c.id === saved.id ? saved : c)) : [saved, ...prev];
        });
        setShowModal(false);
        setEditing(null);
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
            // Deduct local credit
            setCredits(prev => {
                if (!prev || prev.limit === null) return prev;
                const newUsed = prev.used + 1;
                const newRemaining = Math.max(0, (prev.remaining ?? prev.limit) - 1);
                return {
                    ...prev,
                    used: newUsed,
                    remaining: newRemaining,
                    has_credit: newRemaining > 0,
                };
            });
        } catch {
            toast.error("Failed to send test SMS.");
        } finally {
            setTestingId(null);
        }
    };

    /* toggle enabled/disabled inline */
    const handleToggle = async (config: SmsConfiguration, enabled: boolean) => {
        try {
            const updated = await updateSmsConfiguration(config.id, { sms_enabled: enabled });
            setConfigs(prev => prev.map(c => (c.id === updated.id ? updated : c)));
        } catch {
            toast.error("Failed to update configuration.");
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center gap-3 py-16 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                Loading SMS configurations…
            </div>
        );
    }

    return (
        <div className="space-y-4 w-full max-w-full min-w-0">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-base font-semibold text-slate-100">SMS Alert Configurations</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                        Workspace-level phone numbers &amp; thresholds for SMS alerts.
                    </p>
                </div>
                {canManage && (
                    <button
                        onClick={openAdd}
                        className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-500 transition-colors"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Add
                    </button>
                )}
            </div>

            {/* Credit usage banner (Only displayed for plans with a credit limit, e.g. Free plan) */}
            {credits && credits.limit !== null && (
                <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5 shadow-sm">
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
                                    <h4 className="text-sm font-semibold text-slate-100">
                                        Monthly SMS Credits
                                    </h4>
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
                                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-amber-600 hover:bg-amber-500 rounded-lg transition-colors shrink-0 self-start sm:self-auto"
                            >
                                Upgrade Plan
                            </button>
                        )}
                    </div>

                    {credits.limit !== null && (
                        <div className="mt-3.5">
                            <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
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

            {/* Empty state */}
            {configs.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-14 text-slate-500">
                    <MessageSquare className="w-8 h-8 opacity-30" />
                    <p className="text-sm">No SMS configurations yet.</p>
                    {canManage && (
                        <button onClick={openAdd} className="text-sky-400 text-sm hover:underline">
                            Add your first configuration
                        </button>
                    )}
                </div>
            ) : (
                <div className="space-y-2">
                    {configs.map(config => (
                        <div
                            key={config.id}
                            className="flex items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3 hover:border-slate-600 transition-all"
                        >
                            {/* Left: info */}
                            <div className="flex items-center gap-3 min-w-0">
                                <MessageSquare className="w-4 h-4 text-sky-400 shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-slate-100 truncate">{config.name}</p>
                                    <p className="text-xs text-slate-400 font-mono truncate">{config.phone_number ?? "-"}</p>
                                </div>
                                <span className="hidden sm:inline-flex text-xs px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400">
                                    ↓{config.down_threshold} · SSL {config.ssl_days_before}d
                                </span>
                            </div>

                            {/* Right: actions */}
                            <div className="flex items-center gap-2 shrink-0">
                                <ToggleSwitch
                                    checked={config.sms_enabled}
                                    onChange={v => handleToggle(config, v)}
                                    disabled={!canManage}
                                />
                                <button
                                    onClick={() => handleTest(config)}
                                    disabled={testingId === config.id || !config.phone_number || !hasCredits}
                                    title={!hasCredits ? "Monthly SMS credit limit reached" : "Send test SMS"}
                                    className="rounded-md p-1.5 text-sky-400 hover:bg-sky-900/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                    {testingId === config.id
                                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        : <Send className="w-3.5 h-3.5" />}
                                </button>
                                <button
                                    onClick={() => onHistory?.(config.id, config.name)}
                                    title="View history"
                                    className="rounded-md p-1.5 text-slate-400 hover:bg-slate-700 transition-colors"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </button>
                                {canManage && (
                                    <>
                                        <button
                                            onClick={() => openEdit(config)}
                                            title="Edit"
                                            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-700 transition-colors"
                                        >
                                            <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(config)}
                                            title="Delete"
                                            className="rounded-md p-1.5 text-red-400 hover:bg-red-900/30 transition-colors"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <SmsConfigModal
                    initial={editing}
                    domainId={domainId}
                    onClose={() => { setShowModal(false); setEditing(null); }}
                    onSaved={handleSaved}
                />
            )}
        </div>
    );
}

