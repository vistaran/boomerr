import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Globe,
    AlertTriangle,
    ShieldAlert,
    CheckCircle2,
    Activity,
    Users,
    LayoutDashboard,
    Clock,
} from 'lucide-react';
import { apiFetch } from '../services/api-service';
import CommonLoader from '../components/common/common-loader';
import { Link, useNavigate } from 'react-router-dom';
import { ResponsiveContainer, Tooltip as RechartsTooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar, Cell } from 'recharts';
import { RegionSelect } from '../components/domains/region-select';
import toast from 'react-hot-toast';
import DateTimeDisplay from '../components/common/date-time-display';
import type { User } from '../types/user';
import { getProviderMeta } from '../components/integrations/integration-providers';

interface DomainDetail {
    ulid: string;
    name: string;
    status: string;
    uptime: number;
    avg_response: number;
    ssl_expiry: number;
    last_check: string;
    history: Array<{ status: number, date: string }>;
}

interface ActivityLogItem {
    id: string;
    type: string;
    message: string;
    timestamp: string;
    is_error: boolean;
}

interface DepartmentDetail {
    ulid: string;
    name: string;
    users: Array<{ name: string; email: string; role: string }>;
}

interface DashboardIntegration {
    id?: number | null;
    key?: string;
    name: string;
    provider?: string;
    is_active: boolean;
    configured_count?: number;
    is_launched?: boolean;
}

interface DashboardStats {
    data: {
        domains: {
            total: number;
            active: number;
            inactive: number;
            expiring_ssl: number;
            avg_uptime: number;
            list: DomainDetail[];
        };
        incidents: {
            total: number;
            open: number;
        };
        organization: {
            users: number;
            departments: number;
            departments_list: DepartmentDetail[];
            recent_users: Array<{ name: string; email: string; role: string; departmentName: string; last_login_at?: string }>;
            current_plan: string;
        };
        integrations: DashboardIntegration[];
        system_logs: ActivityLogItem[];
        audit_logs: ActivityLogItem[];
        chart_data: any[];
        default_region: string | null;
        last_synced_at: string;
    }
}

interface MonitoringRegion {
    name: string;
    aws_region: string;
}

interface DashboardPageProps {
    currentUser: User | null;
}

// Response time color helpers based on thresholds
function getResponseTimeColorClass(ms: number | null | undefined): string {
    if (ms === null || ms === undefined) return "text-slate-500";
    if (ms <= 600 && ms > 0) return "text-emerald-300";
    if (ms <= 1500 && ms > 600) return "text-amber-500";
    if (ms <= 2800 && ms > 1500) return "text-orange-500";
    if (ms > 2800) return "text-rose-500";
    return "text-slate-500";
}

function getResponseTimeColorHex(ms: number | null | undefined): string {
    if (ms === null || ms === undefined || ms <= 0) return "#64748b"; // slate-500
    if (ms <= 600) return "#34d399"; // emerald-400
    if (ms <= 1500) return "#f59e0b"; // amber-500
    if (ms <= 2800) return "#f97316"; // orange-500
    return "#f43f5e"; // rose-500
}

const BarTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 shadow-xl min-w-[180px]">
                <p className="text-slate-200 text-sm font-medium mb-1 truncate max-w-[220px]" title={data.fullName || data.name}>{data.fullName || data.name}</p>
                <p className="text-slate-400 text-xs">
                    Avg Response: <span className={`font-semibold ${getResponseTimeColorClass(data.avg_response)}`}>{data.avg_response}ms</span>
                </p>
                <p className="text-slate-500 text-[10px] mt-1">Click to view timeline</p>
            </div>
        );
    }
    return null;
};

const SingleDomainTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const val = payload[0].value;
        if (val === null || val === undefined) return null;
        return (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 shadow-xl">
                <p className="text-slate-400 text-xs mb-1">{label}</p>
                <p className="text-sm font-medium">
                    <span className="text-slate-400">Response: </span>
                    <span className={`font-semibold ${getResponseTimeColorClass(val)}`}>{val}ms</span>
                </p>
            </div>
        );
    }
    return null;
};


export default function DashboardPage({ currentUser }: DashboardPageProps) {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [activeLogTab, setActiveLogTab] = useState<'system' | 'audit'>('system');
    const [activeTeamTab, setActiveTeamTab] = useState<'departments' | 'users'>('departments');
    const [selectedChartDomain, setSelectedChartDomain] = useState<string | null>(null);

    // Fetch Stats
    const { data: statsWrapper, isLoading, isError } = useQuery<DashboardStats>({
        queryKey: ['dashboard-stats'],
        queryFn: async () => {
            return await apiFetch<DashboardStats>('/dashboard/stats');
        },
        refetchInterval: 60000,
    });

    // Fetch Regions
    const { data: regionsData } = useQuery<{ data: MonitoringRegion[] }>({
        queryKey: ['monitoring-regions'],
        queryFn: async () => {
            return await apiFetch<{ data: MonitoringRegion[] }>('/monitoring-regions');
        },
    });

    // Update Default Region Mutation
    const updateRegionMutation = useMutation({
        mutationFn: async (region: string) => {
            return await apiFetch('/dashboard/default-region', {
                method: 'POST',
                body: JSON.stringify({ region })
            });
        },
        onSuccess: () => {
            toast.success('Default region updated');
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        },
        onError: () => {
            toast.error('Failed to update region');
        }
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
                <CommonLoader />
            </div>
        );
    }

    if (isError || !statsWrapper) {
        return (
            <div className="flex items-center justify-center min-h-[calc(100vh-64px)] text-slate-400">
                <div className="text-center">
                    <AlertTriangle className="w-12 h-12 text-red-500/50 mx-auto mb-4" />
                    <p>Unable to load dashboard data. Please try again later.</p>
                </div>
            </div>
        );
    }

    const stats = statsWrapper.data;
    const regions = regionsData?.data || [];
    const domains = stats.domains.list || [];
    const chartData = stats.chart_data || [];
    const systemLogs = stats.system_logs || [];
    const auditLogs = stats.audit_logs || [];
    const displayedLogs = activeLogTab === 'system' ? systemLogs : auditLogs;
    const integrations = stats.integrations || [];
    const departments = stats.organization.departments_list || [];
    const recentUsers = stats.organization.recent_users || [];
    const recentDepartments = departments.slice(0, 5);

    const activeIntegrationsCount = integrations.filter(i => i.is_active).length;

    const activeRegion = stats.default_region || 'us-east-1';

    return (
        <div className="px-2 pb-10 pt-2 sm:px-4 sm:pt-4 md:px-6 md:pt-6">
            {/* Header & Region Select */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-6 sm:mb-6">
                <div data-tour="tour-dashboard-overview">
                    <h1 className="text-lg sm:text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2 sm:gap-3 text-slate-50">
                        <div className="rounded-lg sm:rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 p-2 sm:p-2.5 shadow-lg shadow-blue-500/20 flex-shrink-0">
                            <LayoutDashboard size={20} className="sm:w-6 sm:h-6 text-white" />
                        </div>
                        <span className="truncate">Dashboard Overview</span>
                    </h1>
                    <p className="mt-2 text-xs sm:text-sm text-slate-300">
                        Welcome back, here's the current state of your infrastructure.
                    </p>
                </div>
                <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2.5 sm:gap-4 w-full sm:w-auto pt-2 sm:pt-0 border-t border-slate-800/60 sm:border-t-0">
                    <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[11px] sm:text-xs text-slate-400 uppercase tracking-wider font-semibold whitespace-nowrap">Last Synced:</span>
                        <span className="text-xs sm:text-sm text-emerald-400 font-medium whitespace-nowrap">
                            {stats.last_synced_at ? <DateTimeDisplay value={stats.last_synced_at} /> : "-"}
                        </span>
                    </div>
                    <div className="hidden md:block h-6 w-px bg-slate-800"></div>
                    <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs sm:text-sm font-medium text-slate-300 hidden md:inline">Default Region:</span>
                        <div className={updateRegionMutation.isPending ? 'opacity-50 pointer-events-none' : ''}>
                            <RegionSelect
                                regions={regions}
                                selectedRegion={activeRegion || (regions.length > 0 ? regions[0].aws_region : '')}
                                onChange={(val) => updateRegionMutation.mutate(val)}
                                hideAllOption={true}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Stats Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
                <div className="bg-slate-900/40 border border-slate-800/60 p-4 sm:p-5 rounded-xl flex flex-col justify-between hover:border-slate-700 transition-colors">
                    <div className="flex justify-between items-start">
                        <div className="text-slate-400 text-xs sm:text-sm font-medium">Total Domains</div>
                        <div className="p-1.5 bg-blue-500/10 rounded-md"><Globe className="w-4 h-4 text-blue-400" /></div>
                    </div>
                    <div className="sm:mt-0">
                        <div className="text-2xl sm:text-3xl font-bold text-white flex items-baseline gap-2">
                            {stats.domains.total} <span className="text-xs sm:text-sm font-normal text-slate-400">total domains</span>
                        </div>
                        <div className="text-xs text-slate-400 mt-1">Monitored across {regions.length} region{regions.length !== 1 && 's'}</div>
                    </div>
                </div>
                <div className="bg-slate-900/40 border border-slate-800/60 p-4 sm:p-5 rounded-xl flex flex-col justify-between hover:border-slate-700 transition-colors">
                    <div className="flex justify-between items-start">
                        <div className="text-slate-400 text-xs sm:text-sm font-medium">Open Incidents</div>
                        <div className="p-1.5 bg-red-500/10 rounded-md"><AlertTriangle className="w-4 h-4 text-red-400" /></div>
                    </div>
                    <div className="sm:mt-0">
                        <div className="text-2xl sm:text-3xl font-bold text-white flex items-baseline gap-2">
                            {stats.incidents.open} <span className="text-xs sm:text-sm font-normal text-slate-400">out of {stats.incidents.total} total</span>
                        </div>
                        <div className="text-xs text-slate-400 mt-1">{stats.incidents.open === 0 ? 'No active alerts' : 'Requires attention immediately'}</div>
                    </div>
                </div>
                <div className="bg-slate-900/40 border border-slate-800/60 p-4 sm:p-5 rounded-xl flex flex-col justify-between hover:border-slate-700 transition-colors">
                    <div className="flex justify-between items-start">
                        <div className="text-slate-400 text-xs sm:text-sm font-medium">Expiring SSLs</div>
                        <div className="p-1.5 bg-yellow-500/10 rounded-md"><ShieldAlert className="w-4 h-4 text-yellow-400" /></div>
                    </div>
                    <div className="sm:mt-0">
                        <div className="text-2xl sm:text-3xl font-bold text-white flex items-baseline gap-2">
                            {stats.domains.expiring_ssl} <span className="text-xs sm:text-sm font-normal text-slate-400">&lt; 30 days</span>
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
                            {stats.domains.expiring_ssl === 0 ? 'All certificates are valid' : 'Renew soon to prevent downtime'}
                        </div>
                    </div>
                </div>
                <div className="bg-slate-900/40 border border-slate-800/60 p-4 sm:p-5 rounded-xl flex flex-col justify-between hover:border-slate-700 transition-colors">
                    <div className="flex justify-between items-start">
                        <div className="text-slate-400 text-xs sm:text-sm font-medium">Avg Uptime (30d)</div>
                        <div className="p-1.5 bg-emerald-500/10 rounded-md"><Activity className="w-4 h-4 text-emerald-400" /></div>
                    </div>
                    <div className="sm:mt-0">
                        <div className="text-2xl sm:text-3xl font-bold text-white flex items-baseline gap-2">
                            {stats.domains.avg_uptime}% <span className="text-sm font-medium text-emerald-500 flex items-center"></span>
                        </div>
                        <div className="text-xs text-slate-400 mt-1">Excellent performance this week</div>
                    </div>
                </div>
            </div>

            {/* Domains List Section */}
            <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl mb-6 overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-slate-800/60 flex justify-between items-center gap-2">
                    <div className="flex items-center gap-2 sm:gap-3">
                        <h3 className="text-base sm:text-lg font-semibold text-white">Domains</h3>
                        <span className="text-xs text-slate-400 font-medium bg-slate-800/50 px-2 py-0.5 rounded-full">{stats.domains.total} monitored</span>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3">
                        <Link to="/overview" className="text-xs sm:text-sm text-emerald-400 hover:text-emerald-300 font-medium transition-colors whitespace-nowrap">
                            Add domain
                        </Link>
                    </div>
                </div>

                <div className="overflow-x-auto max-h-[400px] overflow-y-auto custom-scrollbar">
                    <table className="w-full min-w-[680px] text-left border-collapse">
                        <thead className="sticky top-0 z-10 bg-slate-900 shadow-sm">
                            <tr className="text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800/80 bg-slate-900">
                                <th className="p-3 sm:p-4 pl-4 sm:pl-5 bg-slate-900 min-w-[200px] text-left">Domain</th>
                                <th className="text-center p-3 sm:p-4 bg-slate-900 min-w-[90px] whitespace-nowrap">Status</th>
                                <th className="text-center p-3 sm:p-4 bg-slate-900 min-w-[100px] whitespace-nowrap">Uptime (30d)</th>
                                <th className="text-center p-3 sm:p-4 bg-slate-900 min-w-[110px] whitespace-nowrap">Avg Response</th>
                                <th className="text-center p-3 sm:p-4 bg-slate-900 min-w-[100px] whitespace-nowrap">SSL Expiry</th>
                                <th className="text-center p-3 sm:p-4 pr-4 sm:pr-5 bg-slate-900 min-w-[120px] whitespace-nowrap">14-Day History</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                            {domains.length > 0 ? (
                                domains.map(domain => (
                                    <tr key={domain.ulid} className="hover:bg-slate-800/20 transition-colors group">
                                        <td className="p-3 sm:p-4 pl-4 sm:pl-5">
                                            <div className="flex items-center gap-2.5 sm:gap-3">
                                                <div className="w-6 h-6 rounded-md bg-slate-800 flex items-center justify-center border border-slate-700 shrink-0">
                                                    <Globe className="w-3 h-3 text-slate-400" />
                                                </div>
                                                <Link
                                                    to={`/overview/${domain.ulid}`}
                                                    className="font-medium text-slate-200 group-hover:text-emerald-400 transition-colors truncate max-w-[180px] sm:max-w-[260px] block"
                                                    title={domain.name}
                                                >
                                                    {domain.name}
                                                </Link>
                                            </div>
                                        </td>
                                        <td className="p-3 sm:p-4 text-center whitespace-nowrap">
                                            {domain.status === 'up' ? (
                                                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                                    Up
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                                                    Down
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-3 sm:p-4 text-sm text-center text-slate-300 whitespace-nowrap">{domain.uptime}%</td>
                                        <td className={`p-3 sm:p-4 text-sm text-center font-medium whitespace-nowrap ${getResponseTimeColorClass(domain.avg_response)}`}>{domain.avg_response}ms</td>
                                        <td className="p-3 sm:p-4 text-center whitespace-nowrap">
                                            <span className={`text-sm ${domain.ssl_expiry < 30 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                                                {domain.ssl_expiry} days
                                            </span>
                                        </td>
                                        <td className="p-3 sm:p-4 pr-4 sm:pr-5 whitespace-nowrap">
                                            <div className="flex items-center justify-center gap-[2px]">
                                                {domain.history.map((day, idx) => (
                                                    <div
                                                        key={idx}
                                                        className={`w-1.5 h-4 rounded-sm ${day.status === 1 ? 'bg-emerald-500' : 'bg-red-500'}`}
                                                        title={`${day.date}: ${day.status === 1 ? 'Operational' : 'Downtime Detected'}`}
                                                    />
                                                ))}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-slate-400">
                                        No domains found. Add a domain to start monitoring.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Lower Grid: Chart & Incident Logs */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                {/* Chart Section */}
                <div className="lg:col-span-2 bg-slate-900/40 border border-slate-800/60 rounded-xl p-5 flex flex-col">
                    <div className="flex justify-between items-center mb-4 gap-2 flex-wrap">
                        <div>
                            <h3 className="text-lg font-semibold text-white">
                                {selectedChartDomain ? (
                                    (() => {
                                        const validIndices = chartData
                                            .map((item, idx) => (typeof item[selectedChartDomain] === 'number' && item[selectedChartDomain] > 0 ? idx : -1))
                                            .filter(idx => idx !== -1);
                                        const hasData = validIndices.length > 0;
                                        const isFull24h = hasData && validIndices[0] === 0 && validIndices.length > 1;
                                        const timelineLabel = !hasData ? 'Timeline' : (isFull24h ? '24h Timeline' : 'Response Timeline');

                                        return (
                                            <>
                                                <span className="truncate inline-block max-w-[300px] align-bottom" title={selectedChartDomain}>
                                                    {selectedChartDomain.length > 35 ? selectedChartDomain.substring(0, 35) + '...' : selectedChartDomain}
                                                </span>
                                                <span className="text-slate-400 font-normal text-sm ml-2">{timelineLabel}</span>
                                            </>
                                        );
                                    })()
                                ) : (
                                    <>Avg Response Time <span className="text-slate-400 font-normal text-sm ml-2">by Domain</span></>
                                )}
                            </h3>
                        </div>
                        {selectedChartDomain ? (
                            <button
                                onClick={() => setSelectedChartDomain(null)}
                                className="text-xs font-medium text-sky-400 hover:text-sky-300 transition-colors flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-400/10 hover:bg-sky-400/20 border border-sky-400/20"
                            >
                                ← All Domains
                            </button>
                        ) : (
                            <div className="hidden sm:flex items-center gap-3 text-[11px] text-slate-400">
                                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400"></span> &le; 600ms</span>
                                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500"></span> 600-1500ms</span>
                                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-orange-500"></span> 1500-2800ms</span>
                                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500"></span> &gt; 2800ms</span>
                            </div>
                        )}
                    </div>

                    {selectedChartDomain ? (
                        /* Single domain line chart view */
                        (() => {
                            const selectedDomain = domains.find(d => d.name === selectedChartDomain);
                            const domainColor = getResponseTimeColorHex(selectedDomain?.avg_response);

                            // Find all valid non-null data points for this domain
                            const validDataIndices: number[] = [];
                            chartData.forEach((item, idx) => {
                                const val = item[selectedChartDomain];
                                if (typeof val === 'number' && val > 0) {
                                    validDataIndices.push(idx);
                                }
                            });
                            const hasDomainData = validDataIndices.length > 0;

                            if (!hasDomainData) {
                                return (
                                    <div className="h-64 w-full flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-800 rounded-xl bg-slate-900/20">
                                        <Clock className="w-8 h-8 text-slate-500 mb-2" />
                                        <p className="text-sm font-medium text-slate-300">No response time data collected yet</p>
                                        <p className="text-xs text-slate-400 mt-1 max-w-sm">
                                            This domain was added recently or hasn't recorded checks in the last 24 hours. Real-time metrics will appear as monitoring checks are completed.
                                        </p>
                                    </div>
                                );
                            }

                            const firstIdx = validDataIndices[0];
                            // If the domain was only added recently, start timeline from the first recorded data point
                            const displayChartData = firstIdx > 0 ? chartData.slice(firstIdx) : chartData;

                            return (
                                <div className="h-64 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart
                                            data={displayChartData}
                                            margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
                                        >
                                            <defs>
                                                <linearGradient id="singleDomainGrad" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={domainColor} stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor={domainColor} stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                            <XAxis dataKey="time" stroke="#475569" fontSize={12} tickLine={false} axisLine={false} minTickGap={30} />
                                            <YAxis domain={[0, 'auto']} stroke="#475569" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}ms`} />
                                            <RechartsTooltip content={<SingleDomainTooltip />} />
                                            <Line
                                                type="monotone"
                                                dataKey={selectedChartDomain}
                                                stroke={domainColor}
                                                strokeWidth={2.5}
                                                connectNulls={false}
                                                dot={{ r: 3.5, fill: domainColor, stroke: '#0f172a', strokeWidth: 1.5 }}
                                                activeDot={{ r: 6, fill: '#0f172a', stroke: domainColor, strokeWidth: 2 }}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            );
                        })()
                    ) : (
                        /* Overview: Horizontal bar chart */
                        <div style={{ height: Math.max(220, domains.length * 40 + 40), maxHeight: 400, overflowY: domains.length > 8 ? 'auto' : 'hidden' }} className="w-full custom-scrollbar">
                            <ResponsiveContainer width="100%" height={Math.max(200, domains.length * 40 + 20)}>
                                <BarChart
                                    data={domains.map((d, i) => ({
                                        name: d.name.length > 24 ? d.name.substring(0, 24) + '...' : d.name,
                                        fullName: d.name,
                                        avg_response: d.avg_response,
                                        colorIndex: i,
                                        status: d.status,
                                    }))}
                                    layout="vertical"
                                    margin={{ top: 5, right: 60, left: 10, bottom: 5 }}
                                    barCategoryGap="20%"
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                                    <XAxis
                                        type="number"
                                        stroke="#475569"
                                        fontSize={11}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(val) => `${val}ms`}
                                    />
                                    <YAxis
                                        type="category"
                                        dataKey="name"
                                        stroke="#94a3b8"
                                        fontSize={11}
                                        tickLine={false}
                                        axisLine={false}
                                        width={180}
                                        tick={({ x, y, payload }: any) => {
                                            const item = domains.find(d => {
                                                const truncated = d.name.length > 24 ? d.name.substring(0, 24) + '...' : d.name;
                                                return truncated === payload.value || d.name === payload.value;
                                            });
                                            const fullName = item?.name || payload.value;
                                            const isUp = item?.status === 'up';
                                            return (
                                                <g transform={`translate(${x},${y})`}>
                                                    <circle cx={-175} cy={0} r={3} fill={isUp ? '#34d399' : '#f87171'} />
                                                    <text x={-165} y={0} dy={4} textAnchor="start" fill="#cbd5e1" fontSize={11} fontFamily="inherit">
                                                        <title>{fullName}</title>
                                                        {payload.value}
                                                    </text>
                                                </g>
                                            );
                                        }}
                                    />
                                    <RechartsTooltip content={<BarTooltip />} cursor={{ fill: 'rgba(148, 163, 184, 0.05)' }} />
                                    <Bar
                                        dataKey="avg_response"
                                        radius={[0, 6, 6, 0]}
                                        cursor="pointer"
                                        onClick={(data: any) => {
                                            if (data?.fullName) setSelectedChartDomain(data.fullName);
                                        }}
                                    >
                                        {domains.map((d, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={getResponseTimeColorHex(d.avg_response)}
                                                fillOpacity={0.85}
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {!selectedChartDomain && domains.length > 0 && (
                        <p className="text-[11px] text-slate-400 mt-3 text-center">Click a bar to view the response time timeline for that domain</p>
                    )}
                </div>

                {/* Activity Log */}
                <div className="lg:col-span-1 bg-slate-900/40 border border-slate-800/60 rounded-xl p-5 flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                            <button
                                onClick={() => setActiveLogTab('system')}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${activeLogTab === 'system' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-300'
                                    }`}
                            >
                                System Logs
                            </button>
                            <button
                                onClick={() => setActiveLogTab('audit')}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${activeLogTab === 'audit' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-300'
                                    }`}
                            >
                                Audit Logs
                            </button>
                        </div>
                        <Link to={activeLogTab === 'system' ? "/logs" : "/logs?tab=audit"} className="text-sm text-sky-400 hover:text-sky-300 transition-colors font-medium">View all</Link>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2 pl-2 custom-scrollbar space-y-4">
                        {displayedLogs.length > 0 ? (
                            displayedLogs.map((log) => (
                                <div key={log.id} className="relative pl-4 border-l-2 border-slate-800 pb-2 last:border-0 last:pb-0">
                                    <div className={`absolute -left-[5px] top-1.5 w-2 h-2 rounded-full ring-4 ring-slate-900 ${log.is_error ? 'bg-red-500' : 'bg-emerald-500'}`}></div>
                                    <p className="text-sm text-slate-200 mb-1">{log.message}</p>
                                    <p className="text-xs text-slate-400">{new Date(log.timestamp).toLocaleString()}</p>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-10 border border-dashed border-slate-800 rounded-lg">
                                <CheckCircle2 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                                <p className="text-sm text-slate-400">No recent activity</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom Grid: Integrations & Departments */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Active Integrations */}
                <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-5 flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-2.5">
                            <h3 className="text-lg font-semibold text-white">Active Integrations</h3>
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                {activeIntegrationsCount} active
                            </span>
                        </div>
                        <Link to="/settings" className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors font-medium">Manage</Link>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-1">
                        {integrations.length > 0 ? (
                            integrations.map((integration) => {
                                const key = integration.key || '';
                                const meta = getProviderMeta(key);
                                const isComingSoon = key === 'call' || integration.is_launched === false;
                                const isActive = Boolean(integration.is_active);
                                const count = integration.configured_count ?? (isActive ? 1 : 0);

                                let statusText = 'Not connected';
                                if (isComingSoon) {
                                    statusText = 'Coming soon';
                                } else if (isActive) {
                                    if (count > 1) {
                                        statusText = `${count} channels connected`;
                                    } else {
                                        statusText = 'Synced';
                                    }
                                }

                                return (
                                    <div key={integration.id ?? key ?? integration.name} className="flex items-center justify-between p-3 bg-slate-800/30 border border-slate-800 rounded-lg hover:border-slate-700 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-slate-800 rounded-md flex items-center justify-center w-9 h-9">
                                                {meta.icon || (
                                                    <div className="w-5 h-5 rounded bg-slate-700"></div>
                                                )}
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-slate-200">{integration.name}</div>
                                                <div className="text-xs text-slate-400">
                                                    {statusText}
                                                </div>
                                            </div>
                                        </div>
                                        {/* Status Indicator */}
                                        <div className={`px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 ${isActive
                                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                                            }`}>
                                            <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`}></div>
                                            <span>
                                                {isActive
                                                    ? (count > 1 ? `${count} Active` : 'Active')
                                                    : 'Inactive'}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="col-span-2 text-center py-8 border border-dashed border-slate-800 rounded-lg">
                                <p className="text-sm text-slate-400">No integrations found</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Departments & Team */}
                <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-5 flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                            <button
                                onClick={() => setActiveTeamTab('departments')}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTeamTab === 'departments' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-300'
                                    }`}
                            >
                                Departments
                            </button>
                            <button
                                onClick={() => setActiveTeamTab('users')}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTeamTab === 'users' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-300'
                                    }`}
                            >
                                Users
                            </button>
                        </div>
                        <span className="text-xs text-slate-400 font-medium bg-slate-800/50 px-2 py-0.5 rounded-full">
                            {activeTeamTab === 'departments' ? `${stats.organization.departments} depts` : `${stats.organization.users} users`}
                        </span>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3">
                        {activeTeamTab === 'departments' ? (
                            recentDepartments.length > 0 ? (
                                recentDepartments.map(dept => (
                                    <div key={dept.ulid} className="p-3 bg-slate-800/30 border border-slate-800 rounded-lg flex items-center justify-between">
                                        <div className="text-sm font-medium text-slate-200">{dept.name}</div>
                                        <div className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded-md">{dept.users.length} users</div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-6 text-sm text-slate-400">No departments found.</div>
                            )
                        ) : (
                            recentUsers.length > 0 ? (
                                recentUsers.map((user, idx) => (
                                    <div key={idx} className="p-3 bg-slate-800/30 border border-slate-800 rounded-lg">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-7 h-7 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-bold border border-indigo-500/20">
                                                    {user.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="text-sm text-slate-300 leading-none">{user.name}</div>
                                                    <div className="text-xs text-slate-400 mt-1">{user.departmentName}</div>
                                                    {user.last_login_at && (
                                                        <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                                                            <span>Last login:</span>
                                                            <DateTimeDisplay value={user.last_login_at} className="font-medium" />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <span className={`text-xs px-2 py-0.5 rounded-md border ${user.role === 'Owner' || user.role === 'admin' || user.role === 'owner'
                                                ? 'bg-amber-500/10 border-amber-500/20 text-amber-500'
                                                : 'bg-blue-500/10 border-blue-500/20 text-blue-500'
                                                }`}>
                                                {user.role}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-6 text-sm text-slate-400">No users found.</div>
                            )
                        )}

                        <button onClick={() => navigate('/departments')} className="w-full mt-2 py-2 border border-dashed border-slate-700 rounded-lg text-sm text-slate-400 hover:text-emerald-400 hover:border-emerald-500/50 transition-colors flex items-center justify-center gap-2">
                            <Users className="w-4 h-4" />
                            View Departments
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
