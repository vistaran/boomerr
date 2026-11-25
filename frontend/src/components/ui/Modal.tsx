import { X } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
    title?: ReactNode;
    children: ReactNode;
    onClose: () => void;
    width?: "sm" | "md" | "lg";
}

const widthMap = {
    sm: "sm:max-w-sm",
    md: "sm:max-w-md",
    lg: "sm:max-w-lg",
};

export function Modal({
    title,
    children,
    onClose,
    width = "md",
}: ModalProps) {
    const modalRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const node = modalRef.current;
        if (!node) return;

        const focusTarget = node.querySelector<HTMLElement>(
            '[data-autofocus], input:not([type="hidden"]), textarea, select'
        );

        if (focusTarget) {
            queueMicrotask(() => focusTarget.focus({ preventScroll: true }));
        }
    }, []);

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
            <div
                className="absolute inset-0 bg-black/90"
                onClick={onClose}
            />

            {/* Modal */}
            <div
                ref={modalRef}
                className={`relative z-10 w-full ${widthMap[width]} max-h-[90vh] overflow-y-auto rounded-xl sm:rounded-2xl border border-slate-800 bg-slate-900 p-3 sm:p-4 md:p-6 shadow-2xl backdrop-blur shadow-lg`}
            >
                {title && (
                    <div className="mb-3 sm:mb-4 flex items-center justify-between gap-2">
                        {typeof title === 'string' ? (
                            <h3 className="text-base sm:text-lg font-semibold text-slate-100 truncate flex-1">{title}</h3>
                        ) : (
                            title
                        )}
                        <button
                            onClick={onClose}
                            className="flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors !outline-none"
                            aria-label="Close modal"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                )}

                {children}
            </div>
        </div>,
        document.body
    );
}
