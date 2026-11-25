import { useState, useEffect } from "react";
import { Check, Copy, Edit3, Trash2, Zap, AlertCircle, XCircle, Info, History, RefreshCw } from "lucide-react";
import type { IntegrationWebhook } from "../../types/integration-webhooks";
import { testNotificationChannel, updateNotificationChannel } from "../../services/integrations-service";
import toast from "react-hot-toast";
import { ToggleSwitch } from "../common/toggle";
import { InfoTooltip } from "../common/info-tooltip";
import DateTimeDisplay from "../common/date-time-display";

export function WebhookCard({ canManage, webhook, index, setEditFormData, setEditingWebhook, setDeleteTarget, fetchWebhooks, onTest, onToggle, onHistory, onEdit, onDelete, onReconnect }: any) {
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [isTesting, setIsTesting] = useState(false);

    // Calculate
    // const formatLastTriggered = (dt: string | null | undefined) => {
    //     if (!dt) return 'Never';
    //     // Parse as UTC and convert to local time
    //     const utcDate = new Date(dt + (dt.endsWith('Z') ? '' : 'Z'));
    //     const now = new Date();
    //     // utcDate is now in local time zone
    //     const diff = Math.floor((now.getTime() - utcDate.getTime()) / 1000); // in seconds
    //     if (diff < 60) return `${diff}s ago`;
    //     if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    //     if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    //     if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
    //     // If more than 30 days, show local date
    //     return utcDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: '2-digit' });
    // };

    const formatSuccessRate = (success: number = 0, failure: number = 0) => {
        const total = success + failure;
        if (total === 0) return '-';
        return `${Math.round((success / total) * 100)}%`;
    };

    // Helper for last trigger status UI
    const getLastTriggerStatusUI = (status: string | null | undefined) => {
        if (!status) {
            return { icon: '', label: '-', color: 'text-slate-400' };
        }
        if (status === 'success') {
            return { icon: <Check className="w-4 h-4 text-emerald-400" />, label: 'Success', color: 'text-emerald-400' };
        }
        if (status.startsWith('error')) {
            return { icon: <XCircle className="w-4 h-4 text-rose-400" />, label: 'Error', color: 'text-rose-400', tooltip: status };
        }
        if (status === 'unsupported') {
            return { icon: <AlertCircle className="w-4 h-4 text-yellow-400" />, label: 'Unsupported', color: 'text-yellow-400' };
        }
        // HTTP error or other
        return { icon: <AlertCircle className="w-4 h-4 text-orange-400" />, label: status, color: 'text-orange-400', tooltip: status };
    };

    const handleTestWebhook = async (id: string) => {
        if (!canManage) return;
        setIsTesting(true);
        try {
            if (onTest) {
                await onTest(id);
                return; // Let the parent handle the toast
            }
            await testNotificationChannel(id);
            if (webhook.type === 'clickup') {
                toast.success('Sample test task created successfully!');
            } else {
                toast.success('Test notification sent!');
            }
        } catch (error) {
            console.error("Error testing webhook", error);
            toast.error('Failed to send test notification');
        } finally {
            setIsTesting(false);
            if (fetchWebhooks) await fetchWebhooks(false);
        }
    };

    const handleCopyUrl = (id: string, url: string) => {
        navigator.clipboard.writeText(url);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleEditWebhook = (webhook: IntegrationWebhook) => {
        if (!canManage) return;
        if (onEdit) return onEdit(webhook);

        if (setEditingWebhook) setEditingWebhook(webhook);
        if (setEditFormData) setEditFormData({
            name: webhook.name,
            url: webhook.url,
            events: webhook.events || [],
        });
    };

    const handleDeleteRequest = async (webhook: IntegrationWebhook) => {
        if (!canManage) return;
        if (onDelete) return onDelete(webhook);

        if (webhook.id && setDeleteTarget) {
            setDeleteTarget(webhook);
        }
    };

    // Toggle handler
    const [toggleLoading, setToggleLoading] = useState(false);
    const isActive = webhook.is_active ?? webhook.enabled ?? false;
    const [localActive, setLocalActive] = useState(isActive);

    useEffect(() => {
        setLocalActive(isActive);
    }, [isActive]);
    // Sync localActive with prop changes
    useEffect(() => {
        setLocalActive(isActive);
    }, [isActive]);

    const handleToggle = async (checked: boolean) => {
        if (!canManage) return;
        setToggleLoading(true);
        setLocalActive(checked); // Optimistic UI update
        try {
            if (onToggle) {
                await onToggle(checked);
            } else {
                await updateNotificationChannel(String(webhook.ulid ?? webhook.id), {
                    is_active: checked,
                });
            }

            toast.success(`Webhook ${checked ? 'enabled' : 'disabled'}`);
            if (fetchWebhooks) await fetchWebhooks(false);
        } catch {
            setLocalActive(!checked); // Revert on error
            toast.error('Failed to update webhook');
        } finally {
            setToggleLoading(false);
        }
    };

    return (
        <div
            key={webhook.ulid ?? webhook.id}
            style={{ animationDelay: `${index * 75}ms` }}
            className="group relative rounded-2xl border border-slate-800/60 bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-slate-800/70 backdrop-blur-sm overflow-visible transition-all duration-300 hover:border-slate-700/80 hover:shadow-md hover:shadow-sky-500/20 hover:-translate-y-1 animate-fade-in-up hover:z-20"
        >
            {/* Animated background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-sky-500/0 via-indigo-500/0 to-purple-500/0 group-hover:from-sky-500/8 group-hover:via-indigo-500/8 group-hover:to-purple-500/8 transition-all duration-500 pointer-events-none rounded-2xl" />

            {/* Subtle grid pattern */}
            <div className="absolute inset-0 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity duration-500 rounded-2xl" style={{
                backgroundImage: 'linear-gradient(rgba(148, 163, 184, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.1) 1px, transparent 1px)',
                backgroundSize: '20px 20px'
            }} />

            <div className="relative p-3">
                {/* Header section */}
                <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 pr-4">
                        <h3 className="font-bold text-slate-50 mb-1 group-hover:text-sky-400 transition-colors duration-200 flex items-center gap-2">
                            {webhook.name}
                        </h3>
                    </div>
                    {/* Toggle Switch for is_active */}
                    <div className="flex flex-col items-end gap-1 mt-2">
                        <ToggleSwitch
                            checked={localActive}
                            onChange={handleToggle}
                            disabled={toggleLoading || !canManage}
                        />
                    </div>
                </div>

                {/* Stats section */}
                <div className="grid grid-cols-1 2xl:grid-cols-2 gap-3 mb-4 p-3 rounded-xl bg-slate-950/50 border border-slate-800/40 w-full">
                    <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                            Last Triggered
                            <InfoTooltip text="The last time this webhook was triggered by an event.">
                                <Info className="w-3 h-3 text-slate-400 cursor-pointer" />
                            </InfoTooltip>
                        </p>
                        <p className="text-sm font-semibold text-slate-300">
                            <DateTimeDisplay
                                value={webhook.last_triggered_at}
                                className="font-medium text-slate-200"
                            />
                        </p>
                    </div>
                    <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                            Success Rate
                            <InfoTooltip text="The percentage of successful webhook deliveries out of all attempts.">
                                <Info className="w-3 h-3 text-slate-400 cursor-pointer" />
                            </InfoTooltip>
                        </p>
                        <p className="text-sm font-semibold text-emerald-400">{formatSuccessRate(webhook.success_count, webhook.failure_count)}</p>
                    </div>
                    <div className="2xl:col-span-2">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                            Last Status
                            <InfoTooltip text="The result of the most recent webhook delivery attempt.">
                                <Info className="w-3 h-3 text-slate-400 cursor-pointer" />
                            </InfoTooltip>
                        </p>
                        {(() => {
                            const statusUI = getLastTriggerStatusUI(webhook.last_trigger_status);
                            return (
                                <span className={`inline-flex items-center gap-1 font-semibold ${statusUI.color}`} title={statusUI.tooltip || statusUI.label}>
                                    {statusUI.icon}
                                    <span className="truncate max-w-[90px] 2xl:max-w-[150px]">{statusUI.label}</span>
                                </span>
                            );
                        })()}
                    </div>
                </div>

                {/* Action buttons */}
                {canManage ? (
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => handleTestWebhook(String(webhook.ulid ?? webhook.id))}
                            disabled={isTesting}
                            className="flex-1 min-w-[100px] inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700/80 bg-slate-800/60 px-4 py-2.5 text-sm font-medium text-slate-300 hover:border-emerald-500/60 hover:text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-black/20"
                        >
                            {isTesting ? (
                                <>
                                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    <span>Testing…</span>
                                </>
                            ) : (
                                <>
                                    <Zap className="w-4 h-4" />
                                    <span>Test</span>
                                </>
                            )}
                        </button>

                        {webhook.type !== 'clickup' && webhook.type !== 'telegram' && (
                            <button
                                onClick={() => handleCopyUrl(String(webhook.ulid ?? webhook.id), webhook.url)}
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700/80 bg-slate-800/60 px-4 py-2.5 text-slate-300 hover:border-violet-500/60 hover:text-violet-300 hover:bg-violet-500/10 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-black/20"
                                title="Copy webhook URL"
                            >
                                {copiedId === String(webhook.ulid ?? webhook.id) ? (
                                    <Check className="h-4 w-4 text-emerald-400" />
                                ) : (
                                    <Copy className="h-4 w-4" />
                                )}
                            </button>
                        )}

                        {webhook.type !== 'telegram' && (
                            <button
                                onClick={() => handleEditWebhook(webhook)}
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700/80 bg-slate-800/60 px-4 py-2.5 text-slate-300 hover:border-sky-500/60 hover:text-sky-300 hover:bg-sky-500/10 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-black/20"
                                title="Edit webhook"
                            >
                                <Edit3 className="h-4 w-4" />
                            </button>
                        )}

                        {webhook.type === 'telegram' && onReconnect && (
                            <button
                                onClick={() => onReconnect(webhook)}
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700/80 bg-slate-800/60 px-4 py-2.5 text-slate-300 hover:border-emerald-500/60 hover:text-emerald-300 hover:bg-emerald-500/10 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-black/20"
                                title="Reconnect"
                            >
                                <RefreshCw className="h-4 w-4" />
                            </button>
                        )}

                        <button
                            onClick={() => handleDeleteRequest(webhook)}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700/80 bg-slate-800/60 px-4 py-2.5 text-slate-300 hover:border-rose-500/60 hover:text-rose-300 hover:bg-rose-500/10 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-black/20"
                            title="Delete webhook"
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>

                        {onHistory && (
                            <button
                                onClick={() => onHistory(webhook)}
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700/80 bg-slate-800/60 px-4 py-2.5 text-slate-300 hover:border-sky-500/60 hover:text-sky-300 hover:bg-sky-500/10 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-black/20"
                                title={webhook.type === 'clickup' ? 'Created Tasks' : 'View history'}
                            >
                                <History className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/40 text-center">
                        <span className="text-xs text-slate-500 font-medium">👁️ View Only</span>
                    </div>
                )}
            </div>
        </div>
    );
}