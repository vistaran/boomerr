import { ShieldCheck, Eye, AlertTriangle, CheckCircle2, Clock, RotateCw } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getSslMonitoring, getSslDetail } from '../services/api-service';
import { getFaviconUrl, isSafeUrl } from '../services/favicon-service';
import DateTimeDisplay from '../components/common/date-time-display';
import Pagination from '../components/common/pagination';
import ResponsiveTable, { TableCell } from '../components/common/responsive-table';
import CommonLoader from '../components/common/common-loader';
import SslDetailModal from '../components/ssl/ssl-detail-modal';
import { usePlanLimits } from '../hooks';
import { PlanLimitGuard } from '../components/common/plan-limit-guard';

const SslMonitoring = () => {
    const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
    const { hasFeature } = usePlanLimits();

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && selectedDomain) {
                setSelectedDomain(null);
            }
        };
        window.addEventListener('keydown', handleEsc, true);
        return () => window.removeEventListener('keydown', handleEsc, true);
    }, [selectedDomain]);
    const [currentPage, setCurrentPage] = useState(1);
    const PER_PAGE = 10;
    const queryClient = useQueryClient();

    const isSslAllowed = hasFeature('ssl_monitoring');

    const { data: domains = [], isLoading, error, refetch, isFetching } = useQuery({
        queryKey: ['ssl-monitoring'],
        queryFn: getSslMonitoring,
        enabled: isSslAllowed,
        refetchInterval: isSslAllowed ? 60000 : false,
    });

    const { data: sslDetail, isLoading: detailLoading } = useQuery({
        queryKey: ['ssl-detail', selectedDomain],
        queryFn: () => getSslDetail(selectedDomain!),
        enabled: isSslAllowed && !!selectedDomain,
    });

    const getSslStatusBadge = (daysRemaining: number | null, lastCheckedAt?: string | null) => {
        if (daysRemaining === null) {
            if (lastCheckedAt) {
                return {
                    text: 'No SSL Detected',
                    className: 'bg-rose-500/10 text-rose-300 border border-rose-500/40',
                };
            }
            return {
                text: 'Not Checked',
                className: 'bg-slate-500/10 text-slate-400 border border-slate-500/40',
            };
        }
        if (daysRemaining < 0) {
            return {
                text: 'Expired',
                className: 'bg-rose-500/10 text-rose-300 border border-rose-500/40',
            };
        }
        if (daysRemaining <= 7) {
            return {
                text: `${daysRemaining}d left`,
                className: 'bg-orange-500/10 text-orange-300 border border-orange-500/40',
            };
        }
        if (daysRemaining <= 30) {
            return {
                text: `${daysRemaining}d left`,
                className: 'bg-amber-500/10 text-amber-300 border border-amber-500/40',
            };
        }
        return {
            text: `${daysRemaining}d left`,
            className: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/40',
        };
    };


    const sortedDomains = [...domains].sort((a, b) => {
        if (a.ssl_days_remaining === null) return 1;
        if (b.ssl_days_remaining === null) return -1;
        return a.ssl_days_remaining - b.ssl_days_remaining;
    });

    // Pagination
    const totalDomains = sortedDomains.length;
    const lastPage = Math.max(1, Math.ceil(totalDomains / PER_PAGE));
    const paginatedDomains = sortedDomains.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

    const handlePageChange = (page: number) => {
        const validPage = Math.min(page, lastPage);
        setCurrentPage(validPage);
    };

    return (
        <section className="px-2 pb-10 pt-2 sm:px-4 sm:pt-4 md:px-6 md:pt-6">
            <PlanLimitGuard allowed={hasFeature('ssl_monitoring')} featureLabel="SSL & Domain Expiration Monitoring">
                <div className="space-y-4 ">
                    <div className="mb-2 flex items-start justify-between">
                        <div>
                            <h1 className="text-lg sm:text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2 sm:gap-3 text-slate-50">
                                <div className="rounded-lg sm:rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 p-2 sm:p-2.5 shadow-lg shadow-emerald-500/20">
                                    <ShieldCheck size={20} className="sm:w-6 sm:h-6 text-white" />
                                </div>
                                <span className="truncate">SSL Monitoring</span>
                            </h1>
                            <p className="mt-2 text-xs sm:text-sm text-slate-300">Monitor the status and expiration of your SSL certificates.</p>
                        </div>
                        <button
                            onClick={() => refetch()}
                            disabled={isFetching}
                            className="inline-flex items-end gap-1.5 rounded-lg bg-slate-800 border border-slate-700 px-2 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700 transition disabled:opacity-50 flex-shrink-0"
                        >
                            <RotateCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
                            <span className="hidden sm:inline">Refresh</span>
                        </button>
                    </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {isLoading ? (
                            Array.from({ length: 4 }).map((_, idx) => (
                                <div
                                    key={idx}
                                    className="rounded-lg bg-slate-900/70 border border-slate-800 p-3 flex items-center gap-3 animate-pulse"
                                >
                                    <div className="w-5 h-5 rounded bg-slate-800" />
                                    <div className="flex-1">
                                        <div className="h-3 w-14 bg-slate-800 rounded mb-2" />
                                        <div className="h-5 w-10 bg-slate-700 rounded" />
                                    </div>
                                </div>
                            ))
                        ) : (
                            <>
                                <div className="rounded-lg bg-slate-900/70 border border-slate-800 p-3 flex items-center gap-3">
                                    <ShieldCheck className="w-5 h-5 text-sky-400 flex-shrink-0" />
                                    <div>
                                        <div className="text-xs text-slate-300">Total</div>
                                        <div className="text-lg font-bold text-slate-100">{domains.length}</div>
                                    </div>
                                </div>
                                <div className="rounded-lg bg-slate-900/70 border border-slate-800 p-3 flex items-center gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                                    <div>
                                        <div className="text-xs text-slate-300">Valid</div>
                                        <div className="text-lg font-bold text-emerald-300">{domains.filter(d => d.ssl_days_remaining !== null && d.ssl_days_remaining > 30).length}</div>
                                    </div>
                                </div>
                                <div className="rounded-lg bg-slate-900/70 border border-slate-800 p-3 flex items-center gap-3">
                                    <Clock className="w-5 h-5 text-amber-400 flex-shrink-0" />
                                    <div>
                                        <div className="text-xs text-slate-300">Expiring <span className='text-[10px]'>(10 days)</span></div>
                                        <div className="text-lg font-bold text-amber-300">{domains.filter(d => d.ssl_days_remaining !== null && d.ssl_days_remaining <= 10 && d.ssl_days_remaining > 0).length}</div>
                                    </div>
                                </div>
                                <div className="rounded-lg bg-slate-900/70 border border-slate-800 p-3 flex items-center gap-3">
                                    <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0" />
                                    <div>
                                        <div className="text-xs text-slate-300">Expired</div>
                                        <div className="text-lg font-bold text-rose-300">{domains.filter(d => d.ssl_days_remaining !== null && d.ssl_days_remaining < 0).length}</div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* SSL Table */}
                    <div className="rounded-lg bg-slate-900/70 border border-slate-800 shadow overflow-x-auto">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <CommonLoader />
                                <span className="ml-2 text-base font-medium text-slate-300">Loading SSL data...</span>
                            </div>
                        ) : error ? (
                            <div className="flex items-center justify-center py-12 text-rose-400">
                                <AlertTriangle className="w-6 h-6 mr-2" />
                                Failed to load SSL monitoring data
                            </div>
                        ) : domains.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                                <ShieldCheck className="w-10 h-10 mb-2 opacity-50" />
                                <p className="text-base font-medium">No domains configured</p>
                                <p className="text-xs mt-1">Add domains to start monitoring SSL certificates</p>
                            </div>
                        ) : (
                            <>
                                <ResponsiveTable>
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="border-b border-slate-800 bg-slate-950/60">
                                                <th className="px-4 py-4 text-left font-semibold text-slate-300 uppercase tracking-wider">Domain</th>
                                                <th className="px-4 py-4 text-left font-semibold text-slate-300 uppercase tracking-wider">Issued</th>
                                                <th className="px-4 py-4 text-left font-semibold text-slate-300 uppercase tracking-wider">Expires</th>
                                                <th className="px-4 py-4 text-left font-semibold text-slate-300 uppercase tracking-wider">Provider</th>
                                                <th className="px-4 py-4 text-left font-semibold text-slate-300 uppercase tracking-wider">Status</th>
                                                <th className="px-4 py-4 text-center font-semibold text-slate-300 uppercase tracking-wider">Details</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800">
                                            {paginatedDomains.map((domain) => {
                                                const statusBadge = getSslStatusBadge(domain.ssl_days_remaining, domain.ssl_last_checked_at);
                                                return (
                                                    <tr
                                                        key={domain.id}
                                                        className="hover:bg-slate-800/60 transition group"
                                                    >
                                                        <TableCell label="Domain" className="px-4 py-2.5 min-w-[180px]">
                                                            <div className="flex items-center gap-2">
                                                                {getFaviconUrl(domain.url) ? (
                                                                    <img
                                                                        src={getFaviconUrl(domain.url)!}
                                                                        alt={`${domain.name} favicon`}
                                                                        className="h-6 w-6 rounded shadow-sm"
                                                                    />
                                                                ) : (
                                                                    <div className="h-6 w-6 rounded shadow-sm bg-slate-700 flex items-center justify-center text-xs">
                                                                        🔒
                                                                    </div>
                                                                )}
                                                                <div className="truncate">
                                                                    <div className="font-medium text-slate-100 truncate max-w-[180px] transition">{domain.name}</div>
                                                                    <a href={isSafeUrl(domain.url) ? domain.url : "#"} className="text-xs text-slate-400 truncate hover:text-sky-400 max-w-[180px]" target={isSafeUrl(domain.url) ? "_blank" : undefined} rel="noopener noreferrer">{domain.url}</a>
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell label="Issued" className="px-4 py-2.5">
                                                            {domain.ssl_valid_from ? (
                                                                <DateTimeDisplay value={domain.ssl_valid_from} formatOptions={{ day: '2-digit', month: 'short', year: '2-digit' }} />
                                                            ) : (
                                                                <span className="text-slate-500">-</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell label="Expires" className="px-4 py-2.5">
                                                            {domain.ssl_valid_to ? (
                                                                <DateTimeDisplay value={domain.ssl_valid_to} formatOptions={{ day: '2-digit', month: 'short', year: '2-digit' }} />
                                                            ) : (
                                                                <span className="text-slate-500">-</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell label="Provider" className="px-4 py-2.5">
                                                            {domain.ssl_issuer || <span className="text-slate-500">-</span>}
                                                        </TableCell>
                                                        <TableCell label="Status" className="px-4 py-2.5">
                                                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium w-fit ${statusBadge.className}`}>
                                                                {statusBadge.text}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell label="Details" className="px-4 py-2.5 text-center">
                                                            <button
                                                                onClick={() => setSelectedDomain(domain.ulid)}
                                                                className="inline-flex items-center gap-1 rounded bg-sky-500/10 border border-sky-500/30 px-2 py-1 text-xs font-medium text-sky-300 hover:bg-sky-500/20 transition shadow-sm w-fit"
                                                            >
                                                                <Eye className="w-4 h-4" />
                                                                View
                                                            </button>
                                                        </TableCell>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </ResponsiveTable>

                                <div className="mt-4">
                                    <Pagination
                                        currentPage={currentPage}
                                        lastPage={lastPage}
                                        total={totalDomains}
                                        onPageChange={handlePageChange}
                                    />
                                </div>
                            </>
                        )}
                    </div>

                    {/* Detail Modal */}
                    {selectedDomain && (
                        <SslDetailModal
                            sslDetail={sslDetail}
                            loading={detailLoading}
                            onClose={() => setSelectedDomain(null)}
                            onRefresh={() => queryClient.invalidateQueries({ queryKey: ['ssl-detail', selectedDomain] })}
                        />
                    )}
                </div>
            </PlanLimitGuard>
        </section>
    );
};

export default SslMonitoring;