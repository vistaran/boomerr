import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Pagination from '../components/common/pagination';
import ResponsiveTable, { TableCell } from '../components/common/responsive-table';
import { useIncidents } from '../hooks/use-incidents';
import DateTimeDisplay from '../components/common/date-time-display';
import { Download, FileText, Table, ChevronDown, CloudAlertIcon } from 'lucide-react';
import { downloadIncidentPdf, downloadAllIncidentsPdf, downloadAllIncidentsCsv } from '../services/incident-service';
import { getFaviconUrl } from '../services/favicon-service';
import CommonLoader from '../components/common/common-loader';
import { usePlanLimits } from '../hooks/use-plan-limits';
import { PlanLimitGuard } from '../components/common/plan-limit-guard';

const IncidentListPage: React.FC = () => {
    const [page, setPage] = useState(1);
    const navigate = useNavigate();
    const { hasFeature, isPlanInfoLoading } = usePlanLimits();
    const isIncidentAllowed = hasFeature('incident_reporting');
    const { data, isLoading, error } = useIncidents({ page }, { enabled: isIncidentAllowed });
    const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
    const [isDownloadingAll, setIsDownloadingAll] = useState(false);
    const [isDownloadingCsv, setIsDownloadingCsv] = useState(false);

    const [isExportOpen, setIsExportOpen] = useState(false);
    const exportRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (exportRef.current && !exportRef.current.contains(event.target as Node)) {
                setIsExportOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    /* -------------------- PLAN CHECK -------------------- */
    if (!isPlanInfoLoading && !isIncidentAllowed) {
        return (
            <section className="px-2 pb-10 pt-2 sm:px-4 sm:pt-4 md:px-6 md:pt-6">
                <PlanLimitGuard allowed={false} featureLabel="Incident Reporting" variant="overlay">
                    <div className="min-h-[40vh] rounded-lg sm:rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6 md:p-8">
                        <div className="space-y-2 sm:space-y-3">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="flex gap-2 sm:gap-4 rounded-lg bg-slate-800/40 p-3 sm:p-4">
                                    <div className="h-3 sm:h-4 w-24 sm:w-32 rounded bg-slate-700/60 flex-shrink-0" />
                                    <div className="h-3 sm:h-4 flex-1 rounded bg-slate-700/60" />
                                    <div className="h-3 sm:h-4 w-20 sm:w-24 rounded bg-slate-700/60 flex-shrink-0" />
                                </div>
                            ))}
                        </div>
                    </div>
                </PlanLimitGuard>
            </section>
        );
    }

    /* -------------------- LOADING -------------------- */
    if (isLoading) {
        return (
            <div className="py-16 text-center">
                <div className="inline-flex items-center gap-3 text-slate-300">
                    <CommonLoader />
                    <span className="text-base font-medium">Loading incidents…</span>
                </div>
            </div>
        );
    }

    /* -------------------- ERROR -------------------- */
    if (error) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center text-rose-400 text-lg">
                Error loading incidents: {error.message}
            </div>
        );
    }

    const handleDownloadAllCsv = async () => {
        if (isDownloadingCsv) return;
        setIsDownloadingCsv(true);
        try {
            const blob = await downloadAllIncidentsCsv();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Incidents_Summary_Report_${new Date().toISOString().slice(0, 10)}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Download CSV failed:', err);
            alert('Failed to download CSV report.');
        } finally {
            setIsDownloadingCsv(false);
        }
    };

    const handleIncidentClick = (incident: any) => {
        navigate(`/incidents/${incident.ulid}`);
    };

    const handleDownload = async (e: React.MouseEvent, incident: any) => {
        e.stopPropagation();
        if (downloadingIds.has(incident.ulid)) return;

        setDownloadingIds(prev => new Set(prev).add(incident.ulid));
        try {
            const blob = await downloadIncidentPdf(incident.ulid);
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Incident_Report_${incident.ulid}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Download failed:', err);
            alert('Failed to download PDF report. Please try again.');
        } finally {
            setDownloadingIds(prev => {
                const next = new Set(prev);
                next.delete(incident.ulid);
                return next;
            });
        }
    };

    const handleDownloadAll = async () => {
        if (isDownloadingAll) return;
        setIsDownloadingAll(true);
        try {
            const blob = await downloadAllIncidentsPdf();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Incidents_Summary_Report_${new Date().toISOString().split('T')[0]}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Download failed:', err);
            alert('Failed to download Incidents Summary Report.');
        } finally {
            setIsDownloadingAll(false);
        }
    };



    const hasIncidents = !!data && data?.data?.length > 0;

    return (
        <section className="px-2 pb-10 pt-2 sm:px-4 sm:pt-4 md:px-6 md:pt-6">
            <div className="min-h-[40vh]">
                {hasIncidents ? (
                    <div className="w-full">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 sm:mb-6">
                            <h1 className="text-lg sm:text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2 sm:gap-3 text-slate-50">
                                <div className="rounded-lg sm:rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 p-2 sm:p-2.5 shadow-lg shadow-rose-500/20">
                                    <CloudAlertIcon size={20} className="sm:w-6 sm:h-6 text-white" />
                                </div>
                                <span className="truncate">Incidents</span>
                            </h1>
                            <div className="relative" ref={exportRef}>
                                <button
                                    onClick={() => setIsExportOpen(!isExportOpen)}
                                    disabled={isDownloadingAll || isDownloadingCsv}
                                    aria-haspopup="true"
                                    aria-expanded={isExportOpen}
                                    className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-800/80 backdrop-blur hover:bg-slate-700 text-slate-100 text-sm font-medium rounded-lg transition-all border border-slate-600 hover:border-slate-500 shadow-sm disabled:opacity-50"
                                >
                                    {(isDownloadingAll || isDownloadingCsv) ? (
                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-transparent" />
                                    ) : (
                                        <Download className="w-4 h-4 text-slate-300" />
                                    )}
                                    {isDownloadingAll ? 'Generating PDF...' : isDownloadingCsv ? 'Generating CSV...' : 'Export'}
                                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isExportOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {isExportOpen && !(isDownloadingAll || isDownloadingCsv) && (
                                    <div className="absolute right-0 mt-1 w-56 rounded-xl bg-slate-900 border border-slate-700/80 shadow-2xl overflow-hidden z-50">
                                        <div className="px-4 py-2 border-b border-slate-700/80">
                                            <span className="text-xs font-medium text-slate-500">Export as</span>
                                        </div>

                                        <div className="p-1.5 flex flex-col gap-0.5">
                                            <button
                                                onClick={() => {
                                                    setIsExportOpen(false);
                                                    handleDownloadAll();
                                                }}
                                                className="w-full inline-flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-800/80 rounded-lg transition-all text-left"
                                            >
                                                <FileText className="w-4 h-4 text-sky-400" />
                                                Download PDF
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setIsExportOpen(false);
                                                    handleDownloadAllCsv();
                                                }}
                                                className="w-full inline-flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-800/80 rounded-lg transition-all text-left"
                                            >
                                                <Table className="w-4 h-4 text-emerald-400" />
                                                Download CSV
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="rounded-lg sm:rounded-xl md:border md:border-slate-800 md:bg-slate-900/80 backdrop-blur md:shadow-xl">
                            <ResponsiveTable className="md:border md:border-slate-800 rounded-xl">
                                <table className="min-w-full text-left text-xs sm:text-sm text-slate-200">
                                    <thead className="bg-slate-900 md:border-b md:border-slate-800 sticky top-0 rounded-t-xl">
                                        <tr>
                                            <th className="py-2 sm:py-3 px-2 sm:px-4 font-semibold text-xs sm:text-sm">Domain</th>
                                            <th className="py-2 sm:py-3 px-2 sm:px-4 font-semibold text-xs sm:text-sm">Status</th>
                                            <th className="py-2 sm:py-3 px-2 sm:px-4 font-semibold text-xs sm:text-sm hidden sm:table-cell">Started At</th>
                                            <th className="py-2 sm:py-3 px-2 sm:px-4 font-semibold text-xs sm:text-sm hidden md:table-cell">Resolved At</th>
                                            <th className="py-2 sm:py-3 px-2 sm:px-4 text-right font-semibold text-xs sm:text-sm flex-shrink-0"></th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {data.data.map((incident) => {
                                            const isOngoing = incident.status === 'ongoing';

                                            return (
                                                <tr
                                                    key={incident.id}
                                                    onClick={() => handleIncidentClick(incident)}
                                                    className="group relative border-b border-slate-800 transition hover:bg-slate-800/50 cursor-pointer text-xs sm:text-sm bg-slate-700/30 md:bg-transparent">
                                                    {/* DOMAIN */}
                                                    <TableCell label="Domain" className="py-3 sm:py-4 px-2 sm:px-4">
                                                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                                                            <div className="flex-shrink-0">
                                                                {getFaviconUrl(incident.domain?.url) ? (
                                                                    <img
                                                                        src={getFaviconUrl(incident.domain?.url)!}
                                                                        alt={incident.domain?.name}
                                                                        className="h-4 w-4 sm:h-5 sm:w-5 rounded-full"
                                                                    />
                                                                ) : (
                                                                    <div className="h-4 w-4 sm:h-5 sm:w-5 rounded-full bg-slate-700 flex items-center justify-center text-xs">
                                                                        ⚠️
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <div className="font-medium text-slate-100 truncate text-xs sm:text-sm">
                                                                    {incident.domain?.name || incident.domain_id}
                                                                </div>
                                                                <div className="text-xs text-slate-500 truncate hidden sm:block">
                                                                    Incident #{incident.ulid}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </TableCell>

                                                    {/* STATUS */}
                                                    <TableCell label="Status" className="py-3 sm:py-4 px-2 sm:px-4">
                                                        {isOngoing ? (
                                                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-900/40 px-2 sm:px-3 py-0.5 sm:py-1 text-rose-300 text-xs font-semibold w-fit">
                                                                Ongoing
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-900/40 px-2 sm:px-3 py-0.5 sm:py-1 text-emerald-300 text-xs font-semibold w-fit">
                                                                Resolved
                                                            </span>
                                                        )}
                                                    </TableCell>

                                                    {/* STARTED - hidden on mobile */}
                                                    <TableCell label="Started At" className="py-3 sm:py-4 px-2 sm:px-4 text-xs hidden sm:table-cell">
                                                        {incident.started_at ? (
                                                            <DateTimeDisplay
                                                                value={incident.started_at}
                                                                className=""
                                                            />
                                                        ) : (
                                                            '-'
                                                        )}
                                                    </TableCell>

                                                    {/* RESOLVED - hidden on mobile and tablet */}
                                                    <TableCell label="Resolved At" className="py-3 sm:py-4 px-2 sm:px-4 text-xs hidden md:table-cell">
                                                        {incident.resolved_at ? (
                                                            <DateTimeDisplay
                                                                value={incident.resolved_at}
                                                                className=""
                                                            />
                                                        ) : (
                                                            '-'
                                                        )}
                                                    </TableCell>

                                                    {/* ACTION */}
                                                    <TableCell label="" className="py-3 sm:py-4 px-2 sm:px-4 text-right flex-shrink-0 hidden md:table-cell view-icon">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <button
                                                                onClick={(e) => handleDownload(e, incident)}
                                                                disabled={downloadingIds.has(incident.ulid)}
                                                                className={`inline-flex items-center justify-center gap-1 text-slate-400 text-xs font-medium transition min-h-[40px] min-w-[40px] rounded-lg hover:bg-slate-800/50 hover:text-sky-400 ${downloadingIds.has(incident.ulid) ? 'opacity-50 cursor-wait' : 'opacity-70 hover:opacity-100'}`}
                                                                title="Download PDF Report"
                                                            >
                                                                {downloadingIds.has(incident.ulid) ? (
                                                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
                                                                ) : (
                                                                    <Download className='w-4 h-4 sm:w-5 sm:h-5' />
                                                                )}
                                                            </button>
                                                        </div>
                                                    </TableCell>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </ResponsiveTable>

                            {/* PAGINATION */}
                            <div className="border-t border-slate-800 bg-slate-900 px-3 py-2">
                                <Pagination
                                    currentPage={data.current_page}
                                    lastPage={data.last_page}
                                    total={data.total}
                                    onPageChange={setPage}
                                />
                            </div>
                        </div>
                    </div>
                ) : (
                    /* -------------------- EMPTY STATE -------------------- */
                    <div className="relative mx-auto max-w-6xl overflow-hidden rounded-2xl bg-slate-950">
                        <div className="absolute inset-0 bg-gradient-to-br from-sky-900/25 via-slate-950 to-blue-900/25" />

                        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 px-10 py-20 items-center">
                            {/* LEFT */}
                            <div>
                                <h1 className="text-4xl font-extrabold text-slate-100 leading-tight">
                                    Your <span className="text-sky-400">incidents overview</span>
                                    <br />
                                    will appear here
                                </h1>

                                <p className="mt-4 text-lg text-slate-400 max-w-lg">
                                    Boomerr is actively monitoring your domains. If anything goes
                                    down, it will appear here immediately.
                                </p>

                                <p className="mt-3 text-sm text-slate-500">
                                    We continuously check uptime, SSL expiry, and response health.
                                </p>

                                <div className="mt-8 flex items-center gap-4">
                                    <span className="inline-flex items-center gap-2 rounded-full bg-sky-900/40 px-4 py-2 text-sky-300 text-sm font-medium">
                                        <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
                                        Monitoring active
                                    </span>

                                    <span className="text-slate-500 text-sm">
                                        No incidents detected so far
                                    </span>
                                </div>
                            </div>

                            {/* RIGHT */}
                            <div className="relative">
                                <div className="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur shadow-xl">
                                    <div className="p-4 border-b border-slate-800 text-slate-400 text-sm font-medium">
                                        Incident preview
                                    </div>

                                    <div className="divide-y divide-slate-800 text-sm">
                                        {[1, 2, 3, 4].map((i) => (
                                            <div
                                                key={i}
                                                className="flex items-center gap-4 px-4 py-3 opacity-50"
                                            >
                                                <div className="w-20 h-3 rounded bg-slate-800" />
                                                <div className="flex-1 h-3 rounded bg-slate-800" />
                                                <div className="w-28 h-3 rounded bg-slate-800" />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="absolute -top-3 -right-3 rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300 shadow">
                                    Example view
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
};

export default IncidentListPage;
