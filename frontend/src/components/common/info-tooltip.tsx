import { useState } from "react";

// Simple tooltip for info icon
export function InfoTooltip({ text, children }: { text: string; children: React.ReactNode }) {
    const [show, setShow] = useState(false);
    return (
        <span className="relative inline-flex items-center"
            onMouseEnter={() => setShow(true)}
            onMouseLeave={() => setShow(false)}
        >
            {children}
            {show && (
                <span
                    className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-[9999] px-3 py-2 rounded bg-slate-800 text-slate-100 text-xs drop-shadow-2xl max-w-[220px] w-max text-center pointer-events-none border border-slate-700"
                    style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}
                >
                    {text}
                </span>
            )}
        </span>
    );
}