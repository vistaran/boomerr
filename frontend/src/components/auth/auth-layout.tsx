import React from "react";
import logo from "../../assets/logo-5.png";

interface AuthLayoutProps {
    children: React.ReactNode;
    title: string;
    subtitle: string;
    customHeader?: React.ReactNode;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children, title, subtitle, customHeader }) => {
    return (
        <div className="flex flex-col items-center w-full min-h-screen bg-[#030303] relative py-20 px-6">
            {/* High-End Design System */}
            <style>{`
                @keyframes draw-path {
                    0% { stroke-dashoffset: 1000; opacity: 0; }
                    50% { opacity: 0.2; }
                    100% { stroke-dashoffset: 0; opacity: 0.1; }
                }
                @keyframes pulse-node {
                    0%, 100% { transform: scale(1); opacity: 0.2; }
                    50% { transform: scale(1.5); opacity: 0.4; }
                }
                @keyframes float-slow {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-15px); }
                }
                .bg-blueprint {
                    background-image: 
                        linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
                    background-size: 80px 80px;
                }
                .network-line {
                    stroke-dasharray: 1000;
                    stroke-dashoffset: 1000;
                    animation: draw-path 12s ease-in-out infinite alternate;
                }
            `}</style>

            <div className="absolute inset-0 overflow-hidden pointer-events-none bg-[#020203]">
                {/* 1. Subtle Digital Grid */}
                <div className="absolute inset-0 bg-blueprint"></div>

                {/* 2. Creative Illustration: Digital Data Nodes */}
                <div className="absolute inset-0 flex items-center justify-center opacity-20">
                    <svg className="w-[110%] h-auto max-w-[1400px]" viewBox="0 0 1000 1000" fill="none">
                        {/* Pulsing Data Nodes */}
                        <g style={{ animation: 'float-slow 8s ease-in-out infinite' }}>
                            <circle cx="150" cy="200" r="2" fill="white" className="opacity-30" />
                            <circle cx="250" cy="250" r="2" fill="white" className="opacity-30" />
                            <circle cx="150" cy="300" r="2" fill="white" className="opacity-30" />
                        </g>

                        <g style={{ animation: 'float-slow 10s ease-in-out infinite', animationDelay: '-2s' }}>
                            <circle cx="850" cy="700" r="2" fill="white" className="opacity-30" />
                            <circle cx="750" cy="750" r="2" fill="white" className="opacity-30" />
                            <circle cx="850" cy="800" r="2" fill="white" className="opacity-30" />
                        </g>

                        {/* Subtle Pulsing Intersections */}
                        <circle cx="250" cy="250" r="4" stroke="white" strokeWidth="0.2" style={{ animation: 'pulse-node 4s infinite' }} />
                        <circle cx="750" cy="750" r="4" stroke="white" strokeWidth="0.2" style={{ animation: 'pulse-node 4s infinite', animationDelay: '1.5s' }} />
                        <circle cx="500" cy="500" r="1.5" fill="white" className="opacity-20" />
                    </svg>
                </div>
            </div>

            {/* Main Auth Container */}
            <div className="relative z-10 w-full max-w-[440px] animate-fade-in-up overflow-visible my-auto">
                <div className="relative group overflow-visible">
                    {/* 4 Corner HUD Brackets - Subtle accents */}
                    <div
                        className="absolute -top-6 -left-6 w-10 h-10 border-t border-l border-white/5 pointer-events-none z-50"
                    />

                    <div
                        className="absolute -top-6 -right-6 w-10 h-10 border-t border-r border-white/5 pointer-events-none z-50"
                    />

                    <div
                        className="absolute -bottom-6 -left-6 w-10 h-10 border-b border-l border-white/5 pointer-events-none z-50"
                    />

                    <div
                        className="absolute -bottom-6 -right-6 w-10 h-10 border-b border-r border-white/5 pointer-events-none z-50"
                    />

                    {/* Glow */}
                    <div className="relative w-full rounded-2xl border border-white/10 bg-[#050505]/95 p-8 sm:p-10 shadow-2xl backdrop-blur-xl overflow-visible z-10">
                        <div className="relative z-10">
                            {customHeader ? (
                                <div className="text-center mb-5">
                                    {customHeader}
                                </div>
                            ) : (
                                <div className="text-center mb-8">
                                    <div className="flex items-center justify-center gap-3.5 mb-3">
                                        <img src={logo} alt="Logo" className="h-9 w-9 object-contain" />
                                        <div className="h-6 w-[1px] bg-white/10"></div>
                                        <h1 className="text-xl font-bold tracking-tight text-white">
                                            {title}
                                        </h1>
                                    </div>
                                    <p className="text-slate-400 text-xs sm:text-sm font-normal tracking-normal whitespace-pre-line leading-relaxed">
                                        {subtitle}
                                    </p>
                                </div>
                            )}
                            {children}
                        </div>
                    </div>
                </div>

                {/* Footer Copyright */}
                <div className="mt-12 text-center">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-[0.3em]">
                        &copy; {new Date().getFullYear()} Boomerr &bull; Open-Source Domain Monitoring
                    </p>
                </div>
            </div>
        </div>
    );
};
