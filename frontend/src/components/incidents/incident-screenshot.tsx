import { useState } from "react";
import { InfoTooltip } from "../common/info-tooltip";
import { Info, X } from "lucide-react";
import { useIncidentScreenshotUrl } from "../../hooks/use-incidents";

export function IncidentScreenshot({ incidentId }: { incidentId: string }) {

    const [showImageModal, setShowImageModal] = useState(false);
    const screenshotUrlQuery = useIncidentScreenshotUrl(incidentId);


    return (
        <>
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                <div className="mb-4 text-sm font-semibold text-slate-300 flex items-center gap-2">
                    Screenshot
                    <InfoTooltip text="Captured at the time the incident was detected">
                        <Info className="w-4 h-4 text-slate-400 cursor-pointer" />
                    </InfoTooltip>
                </div>
                {screenshotUrlQuery.isLoading ? (
                    <div className="flex items-center justify-center h-[280px] text-xs text-slate-400">Loading screenshot…</div>
                ) : screenshotUrlQuery.data ? (
                    <div className="relative group">
                        <img
                            src={screenshotUrlQuery.data}
                            alt="Incident screenshot"
                            className="rounded-lg border border-slate-800 w-full object-contain shadow-lg cursor-pointer"
                            onClick={() => setShowImageModal(true)}
                        />
                        <div
                            className="absolute inset-0 bg-black/90 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center cursor-pointer"
                            onClick={() => setShowImageModal(true)}
                        >
                            <div className="text-white text-sm font-medium flex items-center gap-2">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                </svg>
                                Click to preview
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-[280px] text-xs text-slate-500 bg-slate-950/50 rounded-lg">
                        No screenshot available
                    </div>
                )}
            </div>

            {/* Image Preview Modal */}
            {showImageModal && screenshotUrlQuery.data && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 animate-fade-in"
                    onClick={() => setShowImageModal(false)}
                >
                    <button
                        onClick={() => setShowImageModal(false)}
                        className="absolute top-4 right-4 text-white hover:text-slate-300 transition-colors bg-slate-800/50 rounded-full p-2 backdrop-blur-sm"
                        aria-label="Close"
                    >
                        <X className="w-6 h-6" />
                    </button>

                    <div className="max-w-[95vw] max-h-[95vh] flex flex-col items-center gap-4">
                        <div className="text-white text-sm font-medium bg-slate-900/80 px-4 py-2 rounded-lg backdrop-blur-sm">
                            Screenshot captured at incident detection
                        </div>
                        <img
                            src={screenshotUrlQuery.data}
                            alt="Incident screenshot - Full view"
                            className="max-w-full max-h-[calc(95vh-80px)] object-contain rounded-lg shadow-2xl border border-slate-700"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                </div>
            )}
        </>
    );
}