import { type ReactNode, useEffect, useRef } from "react";

export interface ConfirmModalProps {
  open: boolean;
  title?: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirming?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  tone?: "danger" | "primary" | "neutral";
}

export function ConfirmModal({
  open,
  title = "Confirm",
  description = "Are you sure you want to continue?",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirming = false,
  onConfirm,
  onCancel,
  tone = "neutral",
}: ConfirmModalProps) {
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(() => {
      cancelButtonRef.current?.focus();
    }, 0);
    return () => clearTimeout(handle);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !confirming) {
        onCancel();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, confirming, onCancel]);

  if (!open) return null;

  const confirmText = confirming ? `${confirmLabel}…` : confirmLabel;
  const toneClasses = (() => {
    switch (tone) {
      case "danger":
        return {
          btn: "bg-rose-600 hover:bg-rose-500 text-slate-50 disabled:opacity-60",
        };
      case "primary":
        return {
          btn: "bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-60",
        };
      default:
        return {
          btn: "bg-slate-700 hover:bg-slate-600 text-white disabled:opacity-60",
        };
    }
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 animate-fade-in p-2 sm:p-4">
      <div className="w-full max-w-md rounded-lg sm:rounded-2xl border border-slate-800 bg-slate-900/90 p-4 sm:p-6 shadow-2xl backdrop-blur">
        <div className="mb-4">
          <h2 className="text-base sm:text-lg font-semibold text-slate-100 truncate">{title}</h2>
          <div className="mt-2 text-xs sm:text-sm text-slate-300">{description}</div>
        </div>
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2">
          <button
            type="button"
            disabled={confirming}
            onClick={onCancel}
            ref={cancelButtonRef}
            className="rounded-lg border border-slate-700 px-3 py-2 sm:py-1.5 text-xs sm:text-sm font-medium text-slate-300 hover:bg-slate-800/80 disabled:opacity-50 transition-colors min-h-[44px] sm:min-h-[auto]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={confirming}
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 sm:py-1.5 text-xs sm:text-sm font-semibold transition-colors min-h-[44px] sm:min-h-[auto] ${toneClasses.btn}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;
