import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { User } from "../../types/user";
import type { Incident } from "../../types/incidents";
import { useResolveIncident } from "../../hooks/use-incidents";
import { ChevronLeft, Share2, Download } from "lucide-react";
import { getFaviconUrl } from "../../services/favicon-service";
import DateTimeDisplay from "../common/date-time-display";
import { downloadIncidentPdf } from "../../services/incident-service";

export function IncidentDetailsTitle({ incident, incidentId, currentUser }: { incident: Incident, incidentId: string, currentUser: User }) {

    const navigate = useNavigate();
    const [copied, setCopied] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const resolveMutation = useResolveIncident();

    const canManage = ["owner", "admin"].includes(currentUser.role ?? "");
    const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

    const handleBack = () => {
        navigate('/incidents');
    };

    const isResolved = incident.status === 'resolved';

    const handleCopyLink = () => {
        navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleResolve = () => {
        resolveMutation.mutate(incidentId);
    };

    const handleDownload = async () => {
        if (downloading) return;
        setDownloading(true);
        try {
            const blob = await downloadIncidentPdf(incidentId);
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Incident_Report_${incidentId}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Download failed:', err);
            alert('Failed to download PDF report.');
        } finally {
            setDownloading(false);
        }
    };

    return (
        <div className="mb-6 sm:mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3 flex-wrap">
                    <button
                        title='Back'
                        onClick={handleBack}
                        className="rounded-full border border-slate-700 bg-slate-900 p-2 text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors">
                        <ChevronLeft className='w-5 h-5' />
                    </button>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-100">
                        Incident
                    </h1>
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* <span className="text-slate-400">#{incident.ulid}</span> */}
                        {incident.http_status && (
                            <span className="rounded-full bg-amber-900/40 px-3 py-1 text-xs font-semibold text-amber-300 border border-amber-700/30">
                                HTTP {incident.http_status}
                            </span>
                        )}

                        <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold border ${isResolved
                                ? 'bg-emerald-900/40 text-emerald-300 border-emerald-700/30'
                                : 'bg-rose-900/40 text-rose-300 border-rose-700/30'
                                }`}
                        >
                            {isResolved ? 'Resolved' : 'Ongoing'}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleCopyLink}
                        className="relative rounded-lg border border-slate-700 bg-slate-900 p-2.5 text-slate-300 hover:bg-slate-800 hover:border-slate-600 transition-all"
                        title="Copy link"
                    >
                        <Share2 size={16} />
                        {copied && (
                            <span className="absolute -bottom-8 right-0 rounded-lg bg-slate-800 px-2 py-1 text-xs text-emerald-400 shadow-lg">
                                Copied!
                            </span>
                        )}
                    </button>
                    
                    <button
                        onClick={handleDownload}
                        disabled={downloading}
                        className="rounded-lg border border-slate-700 bg-slate-900 p-2.5 text-slate-300 hover:bg-slate-800 hover:border-slate-600 transition-all disabled:opacity-50"
                        title="Download PDF"
                    >
                        {downloading ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
                        ) : (
                            <Download size={16} />
                        )}
                    </button>

                    <button
                        onClick={handleResolve}
                        disabled={isResolved || resolveMutation.status === 'pending' || !canManage}
                        className="rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50 disabled:!cursor-not-allowed transition-all shadow-lg shadow-sky-900/30"
                    >
                        {resolveMutation.status === 'pending' ? 'Resolving...' : 'Mark as resolved'}
                    </button>
                </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-400">
                <div className="font-medium text-slate-300 flex items-center gap-1.5">
                    {getFaviconUrl(incident.domain?.url) ? (
                        <img
                            src={getFaviconUrl(incident.domain?.url)!}
                            alt={`${incident.domain?.name} favicon`}
                            className="h-5 w-5 rounded"
                        />
                    ) : (
                        <div className="h-5 w-5 rounded bg-slate-700 flex items-center justify-center text-xs">
                            ⚠️
                        </div>
                    )}
                    {incident.domain?.name || incident.domain_id}
                </div>
                <span className="text-slate-600">•</span>
                <span>
                    Detected <DateTimeDisplay value={incident.started_at} />
                </span>
            </div>
        </div>
    );

}