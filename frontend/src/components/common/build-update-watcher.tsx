import { useEffect, useRef } from "react";
import toast from "react-hot-toast";

type VersionResponse = {
    version?: string;
    builtAt?: string;
};

const VERSION_URL = import.meta.env.VITE_API_BASE_URL + "/version.json";
const POLL_MS = Number(import.meta.env.VITE_VERSION_POLL_MS ?? 60000);

export function BuildUpdateWatcher() {
    const initialVersionRef = useRef<string | null>(null);
    const shownRef = useRef(false);

    useEffect(() => {
        let aborted = false;

        const fetchVersion = async (): Promise<string | null> => {
            try {
                const res = await fetch(`${VERSION_URL}?t=${Date.now()}`, {
                    cache: "no-store",
                });
                if (!res.ok) return null;
                const data = (await res.json()) as VersionResponse;
                return data.version ?? null;
            } catch {
                return null;
            }
        };

        const check = async () => {
            const v = await fetchVersion();
            if (aborted) return;
            if (v && initialVersionRef.current && v !== initialVersionRef.current && !shownRef.current) {
                shownRef.current = true;
                toast.custom((t) => (
                    <div
                        className="relative w-full max-w-md overflow-hidden rounded-xl border border-sky-500/20 bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950/50 p-5 shadow-2xl backdrop-blur-sm"
                        style={{
                            animation: t.visible
                                ? 'slideInBounce 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)'
                                : 'slideOut 0.3s ease-out',
                        }}
                    >
                        <style>{`
                            @keyframes slideInBounce {
                                0% {
                                    opacity: 0;
                                    transform: translateY(-100%) scale(0.9);
                                }
                                60% {
                                    opacity: 1;
                                    transform: translateY(10px) scale(1.02);
                                }
                                100% {
                                    transform: translateY(0) scale(1);
                                }
                            }
                            @keyframes slideOut {
                                from {
                                    opacity: 1;
                                    transform: translateY(0) scale(1);
                                }
                                to {
                                    opacity: 0;
                                    transform: translateY(-20px) scale(0.95);
                                }
                            }
                            @keyframes shimmer {
                                0% { background-position: -200% 0; }
                                100% { background-position: 200% 0; }
                            }
                            @keyframes pulseGlow {
                                0%, 100% {
                                    box-shadow: 0 10px 25px -5px rgb(14 165 233 / 0.5), 0 8px 10px -6px rgb(14 165 233 / 0.5);
                                }
                                50% {
                                    box-shadow: 0 20px 35px -5px rgb(14 165 233 / 0.7), 0 12px 15px -6px rgb(14 165 233 / 0.7);
                                }
                            }
                            @keyframes shine {
                                from { transform: translateX(-100%); }
                                to { transform: translateX(100%); }
                            }
                        `}</style>

                        {/* Animated gradient overlay */}
                        <div
                            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-sky-500/0 via-sky-500/10 to-sky-500/0"
                            style={{
                                backgroundSize: '200% 100%',
                                animation: 'shimmer 3s infinite'
                            }}
                        />

                        {/* Glow effect */}
                        <div className="pointer-events-none absolute -top-24 -right-24 h-48 w-48 rounded-full bg-sky-500/20 blur-3xl" />

                        <div className="relative">
                            {/* Icon + Title */}
                            <div className="flex items-start gap-3">
                                <div
                                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 shadow-lg"
                                    style={{
                                        animation: 'pulseGlow 2s ease-in-out infinite'
                                    }}
                                >
                                    <svg
                                        className="h-5 w-5 text-white"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth={2}
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-base font-semibold text-white">
                                        New Version Available
                                    </h3>
                                    <p className="mt-1 text-sm text-slate-300">
                                        A fresh update is ready! Refresh to get the latest features and improvements.
                                    </p>
                                </div>
                            </div>

                            {/* Buttons */}
                            <div className="mt-4 flex gap-3">
                                <button
                                    onClick={() => {
                                        toast.dismiss(t.id);
                                        window.location.reload();
                                    }}
                                    className="group relative flex-1 overflow-hidden rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/30 transition-all duration-200 hover:scale-[1.02] hover:shadow-xl hover:shadow-sky-500/40 active:scale-[0.98]"
                                >
                                    <span className="relative z-10 flex items-center justify-center gap-2">
                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                        Refresh Now
                                    </span>
                                    <div
                                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100"
                                        style={{
                                            animation: 'shine 1s infinite',
                                            animationPlayState: 'paused'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.animationPlayState = 'running';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.animationPlayState = 'paused';
                                        }}
                                    />
                                </button>
                                <button
                                    onClick={() => toast.dismiss(t.id)}
                                    className="rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2.5 text-sm font-medium text-slate-200 backdrop-blur-sm transition-all duration-200 hover:border-slate-600 hover:bg-slate-800 active:scale-[0.98]"
                                >
                                    Later
                                </button>
                            </div>
                        </div>

                        {/* Bottom accent line */}
                        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-sky-500 to-transparent" />
                    </div>
                ), {
                    id: "app-update-available",
                    duration: Infinity,
                    position: "top-center",
                });
            }
        };

        const timer: number = window.setInterval(check, Math.max(10000, POLL_MS));

        fetchVersion().then((v) => {
            if (aborted) return;
            initialVersionRef.current = v;
        });

        return () => {
            aborted = true;
            window.clearInterval(timer);
        };
    }, []);

    return null;
}