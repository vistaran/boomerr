import { useEffect, useMemo, useState } from "react";
import { getFaviconUrl, isSafeUrl } from "../../services/favicon-service";
import DateTimeDisplay from '../common/date-time-display';
import type { DomainResponseStats, DomainStatusStats } from "../../services/api-service";
import { getDomainResponseStats, getDomainStatusStats } from "../../services/api-service";
import { Edit3, Trash2, Activity, Info, ArrowUpFromDot, ArrowDownToDot, EqualApproximately, AlertTriangle } from "lucide-react";
import Tabs from "../common/Tabs";
import DomainIntegrationsTab from "../integrations/domain-integrations-list";
import EChartsReact from "echarts-for-react";
import RollingNumber from "./RollingNumber";
import { InfoTooltip } from "../common/info-tooltip";
import { StatusActivityChart } from "./StatusActivityChart";
import DomainAnalysis from "./domain-analysis";
import type { Domain as ApiDomain } from "../../types/domains";
import { usePlanLimits } from "../../hooks/use-plan-limits";
import { PlanLimitGuard } from "../common/plan-limit-guard";

type Domain = ApiDomain & {
    latest_incident?: {
        ulid: string;
        status: 'resolved' | 'ongoing' | string;
        http_status?: number | null;
        started_at: string;
        resolved_at?: string | null;
        ai_analysis?: string | null;
    } | null;
};

// Workspace timezone helpers for tooltip formatting
function getCurrentWorkspaceTimezone(): string | null {
    try {
        const raw = localStorage.getItem("dm_user");
        if (!raw) return null;
        const obj = JSON.parse(raw);
        const workspaceId = Number(obj?.workspace_id);
        const workspaces = obj?.workspaces;
        if (Array.isArray(workspaces)) {
            const w = workspaces.find((item: any) => Number(item?.id) === workspaceId);
            const tz = w?.timezone;
            if (typeof tz === "string" && tz.trim().length > 0) {
                return tz;
            }
        }
        return null;
    } catch {
        return null;
    }
}

function parseSqlTimestampToUTC(ts: string): Date {
    const [datePart, timePart] = (ts || "").split(" ");
    const [y, m, d] = (datePart || "1970-01-01").split("-").map((v) => Number(v));
    const [hh, mm, ss] = (timePart || "00:00:00").split(":").map((v) => Number(v));
    return new Date(Date.UTC(y || 1970, (m || 1) - 1, d || 1, hh || 0, mm || 0, ss || 0));
}

function formatTimestampInTZ(ts: string, tz?: string): string {
    let date: Date;
    try {
        if (typeof ts === "string" && ts.includes("T")) {
            const d = new Date(ts);
            date = isNaN(d.getTime()) ? parseSqlTimestampToUTC(ts) : d;
        } else {
            date = parseSqlTimestampToUTC(ts);
        }
    } catch {
        date = parseSqlTimestampToUTC(ts);
    }
    const timeZone = tz || Intl.DateTimeFormat().resolvedOptions().timeZone;
    return new Intl.DateTimeFormat(undefined, {
        timeZone,
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    }).format(date);
}

type ResponseTimeInfo = {
    label: string;
    classes: string;
    lineColor: string;
    areaColor: string;
};

function getResponseTimeColorClass(ms: number | null): string {
    if (ms === null) return "text-slate-500";
    if (ms <= 600 && ms > 0) return "text-emerald-300";
    if (ms <= 1500 && ms > 600) return "text-amber-500";
    if (ms <= 2800 && ms > 1500) return "text-orange-500";
    if (ms > 2800) return "text-rose-500";
    return "text-slate-500";
}

function responseTimeInfo(ms: number | null): ResponseTimeInfo {
    if (ms === null) {
        return {
            label: "-",
            classes: getResponseTimeColorClass(null),
            lineColor: "#94a3b8",
            areaColor: "rgba(148, 163, 184, 0.12)",
        };
    }

    if (ms <= 600 && ms > 0) {
        return {
            label: `${ms} ms`,
            classes: getResponseTimeColorClass(ms),
            lineColor: "#34d399",
            areaColor: "rgba(52, 211, 153, 0.12)",
        };
    }

    if (ms <= 1500 && ms > 600) {
        return {
            label: `${ms} ms`,
            classes: getResponseTimeColorClass(ms),
            lineColor: "#f59e0b",
            areaColor: "rgba(245, 158, 11, 0.12)",
        };
    }

    if (ms <= 2800 && ms > 1500) {
        return {
            label: `${ms} ms`,
            classes: getResponseTimeColorClass(ms),
            lineColor: "#f97316",
            areaColor: "rgba(249, 115, 22, 0.12)",
        };
    }

    return {
        label: `${ms} ms`,
        classes: getResponseTimeColorClass(ms),
        lineColor: "#ef4444",
        areaColor: "rgba(239, 68, 68, 0.12)",
    };
}

function sslStatusInfo(domain: Domain) {
    const days = domain.ssl_days_remaining;

    if (days === null || domain.ssl_valid_to === null) {
        return {
            label: "Not checked",
            classes:
                "text-slate-300",
        };
    }

    if (days < 0) {
        return {
            label: "Expired",
            classes: "text-rose-300",
        };
    }

    if (days <= 7) {
        return {
            label: `Expiring in ${days}d`,
            classes:
                "text-amber-300",
        };
    }

    if (days <= 30) {
        return {
            label: `Expiring soon (${days}d)`,
            classes:
                "text-yellow-200",
        };
    }

    return {
        label: `Valid (${days ?? 0}d)`,
        classes:
            "text-emerald-300",
    };
}

type DomainDetailsPanelProps = {
    selectedDomain: Domain;
    canManage?: boolean;
    onEditDomain?: (domain: Domain) => void;
    onDeleteDomain?: (domain: Domain) => void;
    activeTab?: 'details' | 'integrations';
    onTabChange?: (tab: 'details' | 'integrations') => void;
};

export function DomainDetailsPanel(props: DomainDetailsPanelProps) {
    const {
        selectedDomain,
        canManage = true,
        onEditDomain,
        onDeleteDomain,
        activeTab: activeTabProp,
        onTabChange,
    } = props;

    // Internal tab state fallback if parent doesn't provide controlled state
    const [internalTab, setInternalTab] = useState<'details' | 'integrations'>('details');
    const activeTab = activeTabProp ?? internalTab;

    const handleTabChange = (key: 'details' | 'integrations') => {
        if (onTabChange) {
            onTabChange(key);
        } else {
            setInternalTab(key);
        }
    };

    // Plan limit checks
    const { hasFeature } = usePlanLimits();

    const [range, setRange] = useState<"24h" | "7d" | "30d" | "1y">("24h");
    const [stats, setStats] = useState<DomainResponseStats | null>(null);
    const [statsLoading, setStatsLoading] = useState(false);
    const [statsError, setStatsError] = useState<string | null>(null);

    const [statusStats, setStatusStats] = useState<DomainStatusStats | null>(null);
    const [statusError, setStatusError] = useState<string | null>(null);
    const [hasLabels, setHasLabels] = useState<boolean>(false);

    const statusSummary = useMemo(() => {
        if (!statusStats?.buckets) {
            return { up: 0, down: 0, lastChangeAt: null as string | null };
        }

        let up = 0;
        let down = 0;

        for (const b of statusStats.buckets) {
            if (b.status === 'up') up++;
            if (b.status === 'down') down++;
        }

        const lastDown = [...statusStats.buckets]
            .reverse()
            .find(b => b.status === 'down');

        return {
            up,
            down,
            lastChangeAt: lastDown?.bucket_start ?? null,
        };
    }, [statusStats]);

    const responseInfo = useMemo(() => responseTimeInfo(selectedDomain?.last_response_time_ms ?? null), [selectedDomain?.last_response_time_ms]);

    useEffect(() => {
        let isCancelled = false;
        const chooseFallbackBucket = (r: typeof range): "auto" | "1m" | "15m" | "1h" | "1d" => {
            switch (r) {
                case "24h": return "1m";
                case "7d": return "15m";
                case "30d": return "1h";
                case "1y": return "1d";
                default: return "auto";
            }
        };
        async function load() {
            if (!selectedDomain || !selectedDomain.ulid) {
                setStats(null);
                setStatusStats(null);
                return;
            }
            setStatsLoading(true);
            setStatsError(null);
            try {
                let data = await getDomainResponseStats(selectedDomain.ulid, range, "auto");
                const nonZeroCount = Array.isArray(data.ms) ? data.ms.filter((v) => typeof v === 'number' && v > 0).length : 0;
                if (!isCancelled) {
                    if (nonZeroCount < 3) {
                        const fallbackBucket = chooseFallbackBucket(range);
                        if (fallbackBucket !== "auto") {
                            try {
                                const coarser = await getDomainResponseStats(selectedDomain.ulid, range, fallbackBucket);
                                const coarserNonZero = coarser.ms.filter((v) => typeof v === 'number' && v > 0).length;
                                if (coarserNonZero >= nonZeroCount) {
                                    data = coarser;
                                }
                            } catch {
                                // ignore
                            }
                        }
                    }
                    if (Array.isArray(data.labels) && data.labels.length === 0) {
                        setStats(null);
                    } else {
                        setStats(data);
                    }
                }
            } catch (e: any) {
                if (!isCancelled) setStatsError(e?.message ?? "Failed to load stats");
            } finally {
                if (!isCancelled) setStatsLoading(false);
            }

            try {
                const s = await getDomainStatusStats(selectedDomain.ulid, range);
                if (!isCancelled) setStatusStats(s);
            } catch (e: any) {
                if (!isCancelled) setStatusError(e?.message ?? "Failed to load totals");
            }
        }
        load();
        return () => { isCancelled = true; };
    }, [selectedDomain?.ulid, range]);

    const chartOption = useMemo(() => {
        if (!stats) return undefined;
        let msArr = stats.ms || [];
        let labels = stats.labels || [];

        const hasAnyData = msArr.some((v) => typeof v === 'number' && v > 0);
        if (!hasAnyData || labels.length === 0) {
            setHasLabels(false);
            return undefined;
        }
        const firstIdx = msArr.findIndex((v) => typeof v === 'number' && v > 0);
        if (firstIdx > 0) {
            msArr = msArr.slice(firstIdx);
            labels = labels.slice(firstIdx);
        }
        setHasLabels(true);

        const tz = getCurrentWorkspaceTimezone();
        const getColor = (v: number | null) => responseTimeInfo(typeof v === 'number' && v > 0 ? v : null).lineColor;

        const lineSeries: any[] = [];
        for (let i = 0; i < msArr.length - 1; i++) {
            const v1 = typeof msArr[i] === 'number' && msArr[i] > 0 ? msArr[i] : null;
            const v2 = typeof msArr[i + 1] === 'number' && msArr[i + 1] > 0 ? msArr[i + 1] : null;

            if (v1 !== null && v2 !== null) {
                const color1 = getColor(v1);
                const color2 = getColor(v2);

                const segmentData = msArr.map((_, idx) => {
                    if (idx === i) return v1;
                    if (idx === i + 1) return v2;
                    return null;
                });

                lineSeries.push({
                    name: `segment-${i}`,
                    type: 'line',
                    smooth: true,
                    showSymbol: false,
                    lineStyle: {
                        width: 2,
                        color: {
                            type: 'linear',
                            x: 0, y: 0, x2: 1, y2: 0,
                            colorStops: [
                                { offset: 0, color: color1 },
                                { offset: 1, color: color2 }
                            ]
                        }
                    },
                    connectNulls: false,
                    silent: true,
                    animation: true,
                    data: segmentData,
                });
            }
        }

        const dotColors = msArr.map((v) => getColor(typeof v === 'number' && v > 0 ? v : null));
        const dotSeries = {
            name: 'Response Time',
            type: 'line',
            smooth: true,
            showSymbol: false,
            symbol: 'circle',
            symbolSize: 6,
            itemStyle: {
                color: (params: any) => dotColors[params.dataIndex] || '#94a3b8',
            },
            lineStyle: { color: 'transparent', width: 0 },
            connectNulls: true,
            data: msArr.map((v) => (typeof v === 'number' && v > 0 ? v : null)),
        };

        return {
            backgroundColor: 'transparent',
            textStyle: { color: '#cbd5e1' },
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'cross' },
                formatter: (params: any) => {
                    const arr = Array.isArray(params) ? params : [params];
                    const label = arr[0]?.axisValueLabel || arr[0]?.axisValue || arr[0]?.name || '';
                    const when = label ? formatTimestampInTZ(label, tz || undefined) : '';
                    const dataItem = arr.find((item: any) => item?.data !== null && item?.data !== undefined);
                    const val = dataItem?.data;
                    const valStr = val === null || val === undefined ? '-' : `${val} ms`;
                    return `${when}<br/>Response: ${valStr}`;
                },
            },
            legend: { show: false },
            grid: { left: 16, right: 16, top: 28, bottom: 32, containLabel: true },
            xAxis: {
                type: 'category',
                boundaryGap: true,
                data: labels,
                axisLabel: {
                    color: '#94a3b8',
                    interval: 'auto',
                    hideOverlap: true,
                    margin: 12,
                    formatter: (value: string) => {
                        try {
                            const d = parseSqlTimestampToUTC(value);
                            const timeZone = tz || Intl.DateTimeFormat().resolvedOptions().timeZone;
                            return new Intl.DateTimeFormat(undefined, {
                                timeZone,
                                month: 'short',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                            }).format(d);
                        } catch {
                            return value;
                        }
                    },
                },
                axisLine: { lineStyle: { color: '#334155' } },
                axisTick: { alignWithLabel: true },
                splitLine: { show: true, interval: 'auto', lineStyle: { color: '#1f2937', type: 'dashed' } },
            },
            yAxis: {
                type: 'value',
                axisLabel: { color: '#94a3b8' },
                splitLine: { lineStyle: { color: '#1f2937' } },
            },
            dataZoom: [
                { type: 'inside', xAxisIndex: 0 },
            ],
            series: [...lineSeries, dotSeries],
        };
    }, [stats]);

    const avgResponseTime = useMemo(() => {
        if (!stats?.ms?.length) return null;
        const valid = stats.ms.filter(v => typeof v === "number" && v > 0);
        if (!valid.length) return null;
        const sum = valid.reduce((a, b) => a + b, 0);
        return Math.round(sum / valid.length);
    }, [stats]);

    return (
        <section className="w-full h-full bg-slate-950/80 overflow-y-auto">
            <div className="p-3 sm:p-6 md:p-4 lg:p-6 flex flex-col gap-4 sm:gap-4 animate-fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 border-b border-slate-800 pb-4 sm:pb-4">
                    <div className="flex flex-row items-center gap-4 w-full">
                        {getFaviconUrl(selectedDomain.url) ? (
                            <img
                                src={getFaviconUrl(selectedDomain.url)!}
                                alt={`${selectedDomain.name} favicon`}
                                className="h-9 w-9 rounded shadow"
                            />
                        ) : (
                            <div className="h-9 w-9 rounded shadow bg-slate-700 flex items-center justify-center">
                                🌐
                            </div>
                        )}
                        <div className="flex-1 flex-col min-w-0">
                            <h3
                                className="text-lg sm:text-lg font-bold text-slate-50 transition-colors truncate"
                                title={`${selectedDomain.name} (${selectedDomain.environment})`}
                            >
                                {selectedDomain.name && selectedDomain.name.length > 60
                                    ? `${selectedDomain.name.slice(0, 60)}...`
                                    : selectedDomain.name}
                                {" "}<span className="capitalize text-slate-400 text-sm">{`(${selectedDomain.environment})`}</span>
                            </h3>
                            <a href={isSafeUrl(selectedDomain.url) ? selectedDomain.url : "#"}
                                target={isSafeUrl(selectedDomain.url) ? "_blank" : undefined}
                                rel="noreferrer" className="text-xs sm:text-sm text-slate-400 break-all mt-1 sm:mt-0">{selectedDomain.url} </a>
                        </div>
                    </div>
                    {canManage && (
                        <div className="flex gap-2 ml-auto">
                            {onEditDomain && (
                                <button
                                    type="button"
                                    onClick={() => onEditDomain(selectedDomain)}
                                    className="inline-flex items-center rounded-full border border-slate-700/80 p-2 sm:p-3 text-slate-300 transition-all hover:border-sky-500/60 hover:bg-sky-500/10 hover:text-sky-300"
                                    aria-label={`Edit ${selectedDomain.name}`}
                                >
                                    <Edit3 className="h-5 w-5" />
                                </button>
                            )}
                            {onDeleteDomain && (
                                <button
                                    type="button"
                                    onClick={() => onDeleteDomain(selectedDomain)}
                                    className="inline-flex items-center rounded-full border border-slate-700/80 p-2 sm:p-3 text-slate-300 transition-all hover:border-rose-500/60 hover:bg-rose-500/10 hover:text-rose-300"
                                    aria-label={`Delete ${selectedDomain.name}`}
                                >
                                    <Trash2 className="h-5 w-5" />
                                </button>
                            )}
                        </div>
                    )}
                </div>
                {/* Warning banner for plan-limit paused domain */}
                {selectedDomain.paused_reason === 'plan_limit' && (
                    <div className="flex items-center gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm">
                        <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
                        <div className="flex-1">
                            <span className="font-semibold text-amber-200">Monitoring paused - Free plan limit reached</span>
                            <p className="text-xs text-amber-300/80 mt-0.5">
                                This domain exceeds the 10 monitored domains limit on the Free plan. Upgrade your plan to resume active monitoring.
                            </p>
                        </div>
                    </div>
                )}
                {/* Tabs for Details and Integrations */}
                <Tabs
                    tabs={[
                        { key: 'details', label: 'Details' },
                        { key: 'integrations', label: 'Integrations' },
                    ]}
                    activeTab={activeTab}
                    onTabChange={key => handleTabChange(key as 'details' | 'integrations')}
                />
                {/* Details Tab Content */}
                {activeTab === 'details' && (
                    <>
                        <div className="">
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-6">

                                {/* STATUS */}
                                <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/70 p-2">
                                    <span className="text-xs uppercase text-slate-400">Current Status</span>
                                    <span className={`text-sm sm:text-base font-bold mt-1 ${selectedDomain.paused_reason === 'plan_limit'
                                        ? 'text-amber-400'
                                        : selectedDomain.paused_reason === 'user'
                                            ? 'text-slate-400'
                                            : selectedDomain.status === 'up'
                                                ? 'text-emerald-400'
                                                : selectedDomain.status === 'down'
                                                    ? 'text-rose-400'
                                                    : 'text-slate-400'
                                        }`}>
                                        {selectedDomain.paused_reason === 'plan_limit'
                                            ? 'PAUSED (PLAN LIMIT)'
                                            : selectedDomain.paused_reason === 'user'
                                                ? 'PAUSED'
                                                : selectedDomain.status.toUpperCase()}
                                    </span>
                                </div>

                                {/* RESPONSE */}
                                <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/70 p-2">
                                    <span className="text-xs uppercase text-slate-400">Response</span>

                                    <span className={`text-sm sm:text-base font-bold mt-1 ${responseInfo.classes}`}>
                                        {selectedDomain.last_response_time_ms !== null ? (
                                            <RollingNumber value={selectedDomain.last_response_time_ms ?? 0} />
                                        ) : "-"}
                                    </span>
                                </div>

                                <div className="flex flex-col gap-1 rounded-xl border border-slate-800 bg-slate-900/70 p-2">
                                    <span className="text-xs text-slate-400">SSL
                                        <InfoTooltip text="The SSL certificate status of the domain.">
                                            <Info className="w-3 h-3 ml-1 text-slate-400 cursor-pointer" />
                                        </InfoTooltip>
                                    </span>
                                    <span className={
                                        "inline-flex items-center rounded-full text-sm sm:text-base font-semibold mt-1 " +
                                        sslStatusInfo(selectedDomain).classes
                                    }>
                                        {sslStatusInfo(selectedDomain).label}
                                    </span>
                                </div>

                                {/* INCIDENT SIGNAL (Derived from statusSummary - already exists) */}
                                <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/70 p-2">
                                    <span className="text-xs uppercase text-slate-400">Recent Down</span>
                                    <span className={`text-sm sm:text-base font-semibold mt-1 ${statusSummary.down > 0 ? 'text-rose-400' : 'text-emerald-400'
                                        }`}>
                                        {statusSummary.down}
                                    </span>
                                </div>

                                {/* LAST CHECK */}
                                <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/70 p-2">
                                    <span className="text-xs uppercase text-slate-400">Last Check</span>
                                    <span className="text-sm sm:text-base text-slate-200 mt-1">
                                        <DateTimeDisplay value={selectedDomain.last_checked_at} />
                                    </span>
                                </div>

                            </div>
                        </div>

                        <div>

                        </div>
                        {/* Status Events Chart (Apache ECharts) */}
                        <div className="flex flex-col gap-3 sm:gap-2">
                            <div className="flex items-center justify-between gap-3">
                                <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
                                    <Activity className="h-5 w-5 text-sky-400" />
                                    <span className="">
                                        Status & Response Time Overview
                                        <span className="ml-2 text-xs text-slate-400">
                                            {statusStats && statusSummary.lastChangeAt ? (
                                                <>
                                                    (Last change:{" "}
                                                    <span className="text-slate-300">
                                                        <DateTimeDisplay value={statusSummary.lastChangeAt} />
                                                    </span>)
                                                </>
                                            ) : (
                                                <></>
                                            )}
                                        </span>
                                    </span>
                                </h3>
                                <div className="ml-auto inline-flex items-center rounded-full border border-slate-800 bg-slate-900/60 p-0.5">
                                    {["24h", "7d", "30d", "1y"].map((r) => (
                                        <button
                                            key={r}
                                            type="button"
                                            onClick={() => setRange(r as typeof range)}
                                            aria-pressed={range === r}
                                            className={
                                                "px-2.5 py-1 text-xs rounded-full transition-all " +
                                                (range === r ? "bg-slate-800 text-slate-100 border border-slate-700 shadow" : "text-slate-300 hover:bg-slate-800/60")
                                            }
                                        >
                                            {r}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                {/* Response Time Chart */}
                                <div className="lg:col-span-2 min-w-0">
                                    <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-2 pt-1 pb-1 mt-0">
                                        <div className="px-4 pb-2 pt-3 border-b border-slate-800/60">

                                            <div className="flex items-center justify-between flex-wrap gap-2 sm:gap-4">

                                                {/* LEFT - Title */}
                                                <div className="flex items-center gap-2">
                                                    <h4 className="text-xs sm:text-sm font-semibold text-slate-200 truncate">
                                                        Response Time
                                                    </h4>
                                                    <InfoTooltip text="Response time metrics for selected range">
                                                        <Info className="w-3 h-3 sm:w-4 sm:h-4 text-slate-400 cursor-pointer flex-shrink-0" />
                                                    </InfoTooltip>
                                                </div>

                                                {/* RIGHT - Metrics */}
                                                {stats &&
                                                    <div className="flex items-center gap-3 sm:gap-6 text-xs sm:text-sm overflow-x-auto">

                                                        {/* AVG */}
                                                        <div className="flex items-center gap-2 flex-shrink-0">
                                                            <EqualApproximately className="w-3 h-3 sm:w-4 sm:h-4 text-sky-400 flex-shrink-0" />
                                                            <div className="flex flex-col leading-tight">
                                                                <span className="text-xs text-slate-400">Avg</span>
                                                                <span className={`font-bold text-xs sm:text-sm ${getResponseTimeColorClass(avgResponseTime)}`}>
                                                                    {avgResponseTime !== null
                                                                        ? <RollingNumber value={avgResponseTime} />
                                                                        : "-"}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* MIN */}
                                                        <div className="flex items-center gap-2 flex-shrink-0">
                                                            <ArrowDownToDot className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-400 flex-shrink-0" />
                                                            <div className="flex flex-col leading-tight">
                                                                <span className="text-xs text-slate-400">Min</span>
                                                                <span className={`font-bold text-xs sm:text-sm ${getResponseTimeColorClass(stats.min_response_time_ms)}`}>
                                                                    {stats.min_response_time_ms !== null
                                                                        ? <RollingNumber value={stats.min_response_time_ms} />
                                                                        : "-"}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* MAX */}
                                                        <div className="flex items-center gap-2 flex-shrink-0">
                                                            <ArrowUpFromDot className="w-3 h-3 sm:w-4 sm:h-4 text-rose-400 flex-shrink-0" />
                                                            <div className="flex flex-col leading-tight">
                                                                <span className="text-xs text-slate-400">Max</span>
                                                                <span className={`font-semibold text-xs sm:text-sm ${getResponseTimeColorClass(stats.max_response_time_ms)}`}>
                                                                    {stats.max_response_time_ms !== null
                                                                        ? <RollingNumber value={stats.max_response_time_ms} />
                                                                        : "-"}
                                                                </span>
                                                            </div>
                                                        </div>

                                                    </div>
                                                }
                                            </div>
                                        </div>

                                        {hasLabels === true ? (
                                            <>
                                                {statsError && (
                                                    <div className="text-rose-300 text-sm">{statsError}</div>
                                                )}
                                                {!stats && statsLoading && (
                                                    <div className="h-40 sm:h-52 w-full animate-pulse rounded-lg bg-slate-800/40 border border-slate-700" />
                                                )}
                                                {stats && chartOption && (
                                                    <EChartsReact
                                                        style={{ height: 220, width: '100%' }}
                                                        opts={{ renderer: 'canvas' }}
                                                        option={chartOption}
                                                        notMerge={true}
                                                        lazyUpdate={false}
                                                    />
                                                )}
                                            </>
                                        ) : (
                                            <div className="text-slate-400 text-xs sm:text-sm text-center py-2">No response time data available for the selected range.</div>
                                        )}
                                    </div>
                                </div>
                                {/* Status Activity (Custom Grid) */}
                                <div className="lg:col-span-1 min-w-0">
                                    <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-2 pt-1 pb-1 mt-0">
                                        <div className="flex items-center justify-center mb-1 ">
                                            <h4 className="text-xs sm:text-sm font-semibold text-slate-200 px-2 pt-2 pb-0 mb-0 truncate">
                                                Status Activity
                                                <InfoTooltip text="The status activity of the domain over the selected range.">
                                                    <Info className="w-3 h-3 sm:w-4 sm:h-4 ml-1.5 pt-1 text-slate-400 cursor-pointer inline-block" />
                                                </InfoTooltip>
                                            </h4>
                                        </div>
                                        {statusStats ? (
                                            <StatusActivityChart
                                                buckets={statusStats.buckets}
                                            />
                                        ) : statsLoading ? (
                                            <div className="h-52 flex items-center justify-center">
                                                <div className="animate-pulse text-slate-400 text-xs sm:text-sm">Loading status activity...</div>
                                            </div>
                                        ) : statusError ? (
                                            <div className="h-52 flex items-center justify-center text-rose-300 text-xs sm:text-sm">
                                                Error: {statusError}
                                            </div>
                                        ) : (
                                            <div className="h-52 flex items-center justify-center text-slate-400 text-xs sm:text-sm">
                                                No status data available.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        {/* ✅ Latest Incident */}
                        {selectedDomain.latest_incident && (
                            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                                        Latest Incident
                                        <InfoTooltip text="Most recent incident detected for this domain."><Info className="w-3 h-3 ml-1 text-slate-400 cursor-pointer" /></InfoTooltip>
                                    </h3>

                                    <a
                                        href={`/incidents/${selectedDomain.latest_incident.ulid}`}
                                        className="text-sm text-sky-400 hover:text-sky-300"
                                    >
                                        View incident →
                                    </a>
                                </div>

                                <div className="flex flex-wrap items-center gap-3 text-sm">
                                    {/* Status */}
                                    <span
                                        className={`rounded-full px-3 py-1 font-semibold ${selectedDomain.latest_incident.status === 'resolved'
                                            ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/40'
                                            : 'bg-rose-500/10 text-rose-300 border border-rose-500/40'
                                            }`}
                                    >
                                        {selectedDomain.latest_incident.status === 'resolved'
                                            ? 'Resolved'
                                            : 'Ongoing'}
                                    </span>

                                    {/* HTTP */}
                                    {selectedDomain.latest_incident.http_status && (
                                        <span className="rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/40 px-3 py-1 font-semibold">
                                            HTTP {selectedDomain.latest_incident.http_status}
                                        </span>
                                    )}

                                    {/* Time */}
                                    <span className="text-slate-400">
                                        Started{' '}
                                        <span className="text-slate-200">
                                            <DateTimeDisplay value={selectedDomain.latest_incident.started_at} />
                                        </span>
                                    </span>

                                    {selectedDomain.latest_incident.resolved_at && (
                                        <span className="text-slate-400">
                                            Resolved{' '}
                                            <span className="text-slate-200">
                                                <DateTimeDisplay value={selectedDomain.latest_incident.resolved_at} />
                                            </span>
                                        </span>
                                    )}
                                </div>

                                {/* AI summary (optional) */}
                                {selectedDomain.latest_incident.ai_analysis && (
                                    <div className="mt-3 text-sm text-slate-300 bg-slate-950 rounded-lg p-3 border border-slate-800 line-clamp-3">
                                        <span className="font-semibold text-sky-400">
                                            AI analysis:
                                        </span>{' '}
                                        {selectedDomain.latest_incident.ai_analysis}
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="mt-4">
                            <PlanLimitGuard
                                allowed={hasFeature('ai_analysis') ?? false}
                                featureLabel="Boomerr Agent Analysis"
                                variant="overlay"
                            >
                                <DomainAnalysis domainId={selectedDomain.ulid} />
                            </PlanLimitGuard>
                        </div>
                    </>
                )}
                {/* Integrations Tab Content */}
                {activeTab === 'integrations' && (
                    <DomainIntegrationsTab
                        canManage={canManage}
                        domainId={selectedDomain ? selectedDomain.ulid : undefined}
                        domainNumericId={selectedDomain?.id ?? null}
                        domainName={selectedDomain?.name}
                        domainStatus={selectedDomain?.status}
                    />
                )}
            </div>
        </section>
    );
}
