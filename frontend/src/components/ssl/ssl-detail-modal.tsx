import React from 'react';
import { ShieldCheck, AlertTriangle, Clock, RotateCw, X, Server, Globe } from 'lucide-react';
import DateTimeDisplay from '../common/date-time-display';
import CommonLoader from '../common/common-loader';
import { getFaviconUrl } from '../../services/favicon-service';

type Props = {
    sslDetail: any | null;
    loading: boolean;
    onClose: () => void;
    onRefresh: () => void;
};

export default function SslDetailModal({ sslDetail, loading, onClose, onRefresh }: Props) {
    return (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center pt-6 sm:pt-0 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-md sm:max-w-3xl mx-2 rounded-xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-700/50 shadow-2xl overflow-hidden animate-fade-in-up">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/30 bg-gradient-to-r from-slate-900/50 to-transparent">
                    <div className="flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-gradient-to-br from-sky-500/20 to-sky-600/10 border border-sky-500/30">
                            <ShieldCheck className="w-4 h-4 text-sky-400" />
                        </span>
                        <h2 className="text-base font-semibold text-slate-50">SSL Details</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 p-1.5 rounded-lg transition"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="px-4 py-5 max-h-[80vh] sm:max-h-[75vh] overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <CommonLoader />
                        </div>
                    ) : sslDetail ? (
                        <div className="space-y-3">
                            {/* Domain Info */}
                            <div className="rounded bg-slate-800/40 border border-slate-700/30 p-3">
                                <div className="flex items-center gap-2 mb-2">
                                    {getFaviconUrl(sslDetail.domain.url) ? (
                                        <img src={getFaviconUrl(sslDetail.domain.url)!} alt="favicon" className="h-5 w-5 rounded" />
                                    ) : (
                                        <div className="h-5 w-5 rounded bg-slate-700 flex items-center justify-center text-xs">
                                            🔒
                                        </div>
                                    )}
                                    <span className="font-medium text-slate-100 text-sm truncate">{sslDetail.domain.name}</span>
                                </div>
                                <div className="text-xs text-slate-400 truncate mb-1">{sslDetail.domain.url}</div>
                                <div className="flex flex-wrap gap-2 text-xs">
                                    <span className="capitalize">{sslDetail.domain.environment}</span>
                                    <span className={`font-semibold ${sslDetail.domain.status === 'up' ? 'text-emerald-400' : sslDetail.domain.status === 'down' ? 'text-rose-400' : 'text-slate-400'}`}>{sslDetail.domain.status.toUpperCase()}</span>
                                </div>
                            </div>

                            {/* Certificate Info */}
                            <div className="rounded bg-slate-800/40 border border-slate-700/30 p-3 space-y-2">
                                <div className="flex items-center gap-1.5 mb-2">
                                    <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                                    <span className="text-xs font-semibold text-slate-300">Certificate Details</span>
                                </div>
                                <div className="flex items-start justify-between text-xs">
                                    <span className="text-slate-300">Subject:</span>
                                    <span className={`font-medium text-right ${sslDetail.ssl.subject && sslDetail.ssl.subject !== 'Unknown' ? 'text-slate-200' : 'text-slate-500'}`}>
                                        {sslDetail.ssl.subject || 'Unknown'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-300">Type:</span>
                                    <span className={`font-medium ${sslDetail.ssl.certificate_type && sslDetail.ssl.certificate_type !== 'Unknown' ? 'text-slate-200' : 'text-slate-500'}`}>
                                        {sslDetail.ssl.certificate_type || 'Unknown'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-300">Serial Number:</span>
                                    <span className={`font-mono text-[10px]  ${sslDetail.ssl.serial_number && sslDetail.ssl.serial_number !== 'Unknown' ? 'text-slate-200' : 'text-slate-500'}`}>
                                        {sslDetail.ssl.serial_number || 'Unknown'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-300">Algorithm:</span>
                                    <span className={`font-medium ${sslDetail.ssl.signature_algorithm && sslDetail.ssl.signature_algorithm !== 'Unknown' ? 'text-slate-200' : 'text-slate-500'}`}>
                                        {sslDetail.ssl.signature_algorithm || 'Unknown'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-xs bg-slate-700/30 rounded px-2 py-1 border border-slate-600/50">
                                    <span className="text-slate-300">Issuer:</span>
                                    <span className={`font-medium text-right ${sslDetail.ssl.issuer && sslDetail.ssl.issuer !== 'Unknown' ? 'text-slate-200' : 'text-slate-500'}`}>
                                        {sslDetail.ssl.issuer
                                            ? sslDetail.ssl.issuer.split(',').map((issuerPart: string, idx: number) => (
                                                <div key={idx}>{issuerPart.trim()}</div>
                                            ))
                                            : 'Unknown'}
                                    </span>
                                </div>
                            </div>

                            {/* Validity Period */}
                            <div className="rounded bg-slate-800/40 border border-slate-700/30 p-3 space-y-2">
                                <div className="flex items-center gap-1.5 mb-2">
                                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                                    <span className="text-xs font-semibold text-slate-300">Validity Period</span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-300">Valid From:</span>
                                    <span className="font-medium text-slate-200">{sslDetail.ssl.valid_from ? (<DateTimeDisplay value={sslDetail.ssl.valid_from} />) : '-'}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-300">Valid To:</span>
                                    <span className="font-medium text-slate-200">{sslDetail.ssl.valid_to ? (<DateTimeDisplay value={sslDetail.ssl.valid_to} />) : '-'}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-300">Days Left:</span>
                                    <span className={`font-bold ${sslDetail.ssl.is_expired ? 'text-rose-400' : sslDetail.ssl.expires_soon ? 'text-amber-400' : sslDetail.ssl.is_valid ? 'text-emerald-400' : 'text-slate-300'}`}>
                                        {sslDetail.ssl.days_remaining !== null
                                            ? sslDetail.ssl.days_remaining < 0
                                                ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-300 border border-rose-500/40 font-bold">Expired</span>
                                                : `${sslDetail.ssl.days_remaining} days`
                                            : '-'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-300">Last Checked:</span>
                                    <span className="font-medium text-slate-200">{sslDetail.ssl.last_checked_at ? (<DateTimeDisplay value={sslDetail.ssl.last_checked_at} />) : '-'}</span>
                                </div>

                            </div>
                            {/* Platform, Hosting & SANs in one row */}
                            <div className="flex flex-col md:flex-row gap-3">
                                {/* Platform & Hosting */}
                                <div className="flex-1 rounded bg-slate-800/40 border border-slate-700/30 p-3 space-y-2">
                                    <div className="flex items-center gap-1.5 mb-2">
                                        <Server className="w-3.5 h-3.5 text-indigo-400" />
                                        <span className="text-xs font-semibold text-slate-300">Platform & Hosting</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-slate-300">Platform:</span>
                                        <span className={`font-medium ${sslDetail.ssl.platform && sslDetail.ssl.platform !== 'Unknown' ? 'text-slate-200' : 'text-slate-500'}`}>
                                            {sslDetail.ssl.platform || 'Unknown'}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-slate-300">Hosting Provider:</span>
                                        <span className={`font-medium text-right max-w-[150px] truncate ${sslDetail.ssl.hosting_provider && sslDetail.ssl.hosting_provider !== 'Unknown' ? 'text-slate-200' : 'text-slate-500'}`}>
                                            {sslDetail.ssl.hosting_provider || 'Unknown'}
                                        </span>
                                    </div>
                                </div>

                                {/* SANs */}
                                {sslDetail.ssl.sans && sslDetail.ssl.sans.length > 0 && (
                                    <div className="flex-1 rounded bg-slate-800/40 border border-slate-700/30 p-3">
                                        <div className="flex items-center gap-1.5 mb-2">
                                            <Globe className="w-3.5 h-3.5 text-emerald-400" />
                                            <span className="text-xs font-semibold text-slate-300">Subject Alternative Names ({sslDetail.ssl.sans.length})</span>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {sslDetail.ssl.sans.slice(0, 5).map((san: string, idx: number) => (
                                                <span key={idx} className="inline-block px-2 py-0.5 rounded bg-slate-700/40 text-xs text-slate-300 font-mono">
                                                    {san}
                                                </span>
                                            ))}
                                            {sslDetail.ssl.sans.length > 5 && (
                                                <span className="inline-block px-2 py-0.5 rounded bg-slate-700/40 text-xs text-slate-400">
                                                    +{sslDetail.ssl.sans.length - 5} more
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Status Alert */}
                            {sslDetail.ssl.is_expired && (
                                <div className="rounded bg-rose-500/10 border border-rose-500/30 p-3 flex items-start gap-2 text-xs">
                                    <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <div className="font-semibold text-rose-300">SSL Expired</div>
                                        <div className="text-rose-200/80 mt-0.5">This SSL certificate has expired. Please renew it immediately.</div>
                                    </div>
                                </div>
                            )}
                            {sslDetail.ssl.expires_soon && !sslDetail.ssl.is_expired && (
                                <div className="rounded bg-amber-500/10 border border-amber-500/30 p-3 flex items-start gap-2 text-xs">
                                    <Clock className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <div className="font-semibold text-amber-300">Expiring Soon</div>
                                        <div className="text-amber-200/80 mt-0.5">This SSL certificate will expire in {sslDetail.ssl.days_remaining} days. Consider renewing it soon.</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-slate-400 text-xs">
                            Failed to load SSL details
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700/30 bg-gradient-to-r from-slate-900/50 to-transparent gap-2">
                    <button
                        onClick={() => onRefresh()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-sky-600/40 text-sky-300 hover:bg-sky-500/10 hover:border-sky-600/60 transition"
                    >
                        <RotateCw className="w-3.5 h-3.5" />
                        Refresh Details
                    </button>
                    <button
                        onClick={onClose}
                        className="px-3 py-1.5 text-xs font-medium rounded border border-slate-600/40 text-slate-300 hover:bg-slate-800/50 hover:border-slate-600/60 transition"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
