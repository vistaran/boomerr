import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Clock,
    Loader2,
    RefreshCcw,
    RefreshCw,
    Search,
    Shield,
    Sparkles,
    User,
    Zap,
} from 'lucide-react';
import React, { useState } from 'react';

import {
    type ApiError,
    type DomainAnalysisRecord,
    getDomainAnalysis,
    reanalyzeDomainAnalysis,
} from '../../services/api-service';
import { ScoreRing } from './domain-score-ring';
import { usePlanLimits } from '../../hooks/use-plan-limits';

type DomainAnalysisProps = {
    domainId: string | null;
    canManage?: boolean;
};

type Flag = { color: string; label: string; risk: number };

type AnalysisSectionConfig = {
    key: 'performance' | 'seo' | 'ux' | 'security';
    title: string;
    icon: React.ReactNode;
    score?: number | null;
    suggestions: string[];
};

const getFlagColor = (text: string): Flag => {
    const t = text.toLowerCase();
    if (/critical|urgent|severe|breach|vulnerability|attack|exposed|risk/.test(t)) {
        return { color: 'bg-rose-500/80 text-white', label: 'Critical', risk: 3 };
    }
    if (/warning|important|slow|timeout|error|issue|fix/.test(t)) {
        return { color: 'bg-orange-400/80 text-white', label: 'Warning', risk: 2 };
    }
    if (/recommend|suggest|improve|optimize|update|review/.test(t)) {
        return { color: 'bg-yellow-300/80 text-slate-900', label: 'Normal', risk: 1 };
    }
    return { color: 'bg-sky-500/70 text-white', label: 'Info', risk: 0 };
};

const getImpact = (text: string): string => {
    if (/critical|urgent|severe|breach|vulnerability|attack|risk/.test(text.toLowerCase())) {
        return 'Severe impact on system stability or security.';
    }
    if (/warning|slow|timeout|error|issue/.test(text.toLowerCase())) {
        return 'May affect performance or reliability.';
    }
    if (/recommend|suggest|improve|optimize/.test(text.toLowerCase())) {
        return 'Recommended for optimization or improvement.';
    }
    return 'Informational insight.';
};

const timeAgo = (dateString?: string) => {
    if (!dateString) return null;
    const diff = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
};

const AnalysisSection = ({
    title,
    icon,
    score,
    suggestions,
}: {
    title: string;
    icon: React.ReactNode;
    score?: number | null;
    suggestions: string[];
}) => (
    <div className="rounded-lg border border-slate-800 bg-slate-950/55 p-3 transition">
        <div className="mb-2 flex items-center justify-between min-h-12">
            <div className="flex items-center gap-2">
                {icon}
                <h5 className="text-xs font-bold uppercase tracking-wide text-slate-200">
                    {title}
                </h5>
            </div>
            {typeof score === 'number' && !Number.isNaN(score) && <ScoreRing score={score} />}
        </div>

        {suggestions.length ? (
            <div className="space-y-1.5">
                {suggestions
                    .map((s) => ({ text: s, flag: getFlagColor(s) }))
                    .sort((a, b) => b.flag.risk - a.flag.risk)
                    .map(({ text, flag }, i) => (
                        <div
                            key={i}
                            className="rounded-md border border-slate-800 bg-slate-900/60 p-2"
                        >
                            <div className="flex items-start gap-2">
                                <span
                                    className={`shrink-0 rounded px-2 py-0.5 mt-0.5 text-[10px] min-w-15 text-center font-semibold uppercase tracking-wide ${flag.color}`}
                                >
                                    {flag.label}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs text-slate-200 leading-relaxed">
                                        {text}
                                    </p>
                                    <p className="mt-0.5 text-xs text-slate-400 leading-relaxed">
                                        {getImpact(text)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
            </div>
        ) : (
            <p className="text-xs text-slate-500">No insights available.</p>
        )}
    </div>
);

const DomainAnalysis = ({ domainId, canManage = true }: DomainAnalysisProps) => {
    const queryClient = useQueryClient();
    const [actionError, setActionError] = useState<string | null>(null);
    const { hasFeature } = usePlanLimits();
    const isAiAllowed = hasFeature('ai_analysis');
    const hasDomainId = typeof domainId === 'string';

    const { data, isLoading, isFetching } = useQuery<
        DomainAnalysisRecord | null,
        ApiError
    >({
        queryKey: ['domain-analysis', domainId],
        queryFn: () => getDomainAnalysis(domainId as string),
        enabled: hasDomainId && isAiAllowed,
        staleTime: 1000 * 60 * 5,
        meta: { suppressErrorToast: true },
    });

    const { mutateAsync, isPending } = useMutation({
        mutationFn: (id: string) => reanalyzeDomainAnalysis(id),
        onSuccess: (res, id) => {
            setActionError(null);
            queryClient.setQueryData(['domain-analysis', id], res);
        },
        onError: (err: ApiError) => {
            setActionError(err?.message ?? 'Failed to refresh analysis.');
            setTimeout(() => setActionError(null), 5000);
        },
    });

    const resolved = data ?? null;
    const loading = hasDomainId && (isLoading || (!resolved && isFetching));

    const validScores = resolved
        ? [resolved.performance, resolved.seo, resolved.ux].filter(
            (v): v is number => typeof v === 'number' && !Number.isNaN(v)
        )
        : [];

    const overallScore = validScores.length > 0
        ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
        : null;

    const sections: AnalysisSectionConfig[] = resolved
        ? [
            {
                key: 'performance',
                title: 'Performance',
                icon: (
                    <div className="rounded border border-blue-400/30 bg-blue-500/20 p-1">
                        <Zap className="h-4 w-4 text-blue-400" />
                    </div>
                ),
                score: resolved.performance,
                suggestions: resolved.performanceSuggestions,
            },
            {
                key: 'seo',
                title: 'SEO',
                icon: (
                    <div className="rounded border border-purple-400/30 bg-purple-500/20 p-1">
                        <Search className="h-4 w-4 text-purple-400" />
                    </div>
                ),
                score: resolved.seo,
                suggestions: resolved.seoSuggestions,
            },
            {
                key: 'ux',
                title: 'User Experience',
                icon: (
                    <div className="rounded border border-emerald-400/30 bg-emerald-500/20 p-1">
                        <User className="h-4 w-4 text-emerald-400" />
                    </div>
                ),
                score: resolved.ux,
                suggestions: resolved.uxSuggestions,
            },
            {
                key: 'security',
                title: 'Security Suggestions',
                icon: (
                    <div className="rounded border border-indigo-400/30 bg-indigo-500/20 p-1">
                        <Shield className="h-4 w-4 text-indigo-400" />
                    </div>
                ),
                suggestions: resolved.securitySuggestions,
            },
        ]
        : [];

    return (
        <div>
            {/* Header */}
            <div className="mb-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                    <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-blue-400 flex-shrink-0" />
                        <h4 className="text-base sm:text-lg font-bold text-slate-100 truncate">
                            Boomerr Agent Analysis
                        </h4>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3 text-slate-300 flex-wrap sm:flex-nowrap justify-start sm:justify-end">
                        {overallScore !== null && !Number.isNaN(overallScore) && <ScoreRing score={overallScore} />}

                        {resolved?.updated_at && (
                            <span className="flex items-center gap-1 rounded bg-slate-700/40 px-2 py-1 text-xs whitespace-nowrap">
                                <Clock className="h-3 w-3 text-slate-400 flex-shrink-0" />
                                <span className="text-slate-400">
                                    {timeAgo(resolved.updated_at)}
                                </span>
                            </span>
                        )}

                        {canManage && (
                            <button
                                onClick={() => domainId && mutateAsync(domainId)}
                                disabled={isPending || loading || !domainId}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-800/60 px-2 sm:px-3 py-1.5 text-xs font-semibold text-slate-100 hover:border-blue-400 disabled:opacity-60 whitespace-nowrap"
                            >
                                {isPending ? (
                                    <RefreshCcw className="h-3 w-3 sm:h-4 sm:w-4 animate-spin flex-shrink-0" />
                                ) : (
                                    <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                                )}
                                <span className="hidden sm:inline">Refresh</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
            {actionError && (
                <div className="mb-3 rounded border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                    Unable to refresh analysis, Please try again later.
                </div>
            )}

            {/* {actionError && setTimeout(() => setActionError(null), 5000)} */}

            {loading && (
                <div className="flex items-center justify-center py-8 text-blue-400">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            )}

            {resolved && !loading && (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {sections.map((s) => {
                        const { key, ...props } = s;
                        return <AnalysisSection key={key} {...props} />;
                    })}
                </div>
            )}

            {!loading && !resolved && (
                <div className="flex flex-col items-center gap-2 py-8 text-slate-500 rounded-lg border border-slate-800 bg-slate-950/55 p-3 transition">
                    <Shield className="h-8 w-8" />
                    <p className="text-sm">No analysis data available.</p>
                </div>
            )}
        </div>
    );
};

export default DomainAnalysis;
