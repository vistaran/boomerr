import { useState, type ReactNode } from "react";

type TooltipProps = {
    children: ReactNode;
    label: string;
    side?: "right" | "left" | "top" | "bottom";
};

export function Tooltip({ children, label, side = "right" }: TooltipProps) {
    // Simple tooltip implementation
    const [show, setShow] = useState(false);
    return (
        <span
            className="relative flex items-center"
            onMouseEnter={() => setShow(true)}
            onMouseLeave={() => setShow(false)}
        >
            {children}
            {show && (
                <span
                    className={`absolute whitespace-nowrap z-50 px-2 py-1 rounded bg-slate-800 text-slate-100 text-xs shadow-lg ${side === "right"
                        ? "left-full ml-2 top-1/2 -translate-y-1/2"
                        : side === "left"
                            ? "right-full mr-2 top-1/2 -translate-y-1/2"
                            : side === "top"
                                ? "bottom-full mb-2 left-1/2 -translate-x-1/2"
                                : "top-full mt-2 left-1/2 -translate-x-1/2"
                        }`}
                    style={{ pointerEvents: "none" }}
                >
                    {label}
                </span>
            )}
        </span>
    );
}