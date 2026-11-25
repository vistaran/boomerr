import { AlertTriangle } from "lucide-react";
import type { DomainIntegration } from "../../types/domain-integrations";
import { useEffect } from "react";

type DeleteWebhookModalProps = {
    open: boolean;
    provider: DomainIntegration;
    webhook: {
        id: number;
        name: string;
        url: string;
    } | null;
    deleting: boolean;
    onCancel: () => void;
    onConfirm: () => void;
};

export function DeleteWebhookModal({
    open,
    provider,
    webhook,
    deleting,
    onCancel,
    onConfirm,
}: DeleteWebhookModalProps) {
    if (!open || !webhook) return null;

    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
        if (!open) return;

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onCancel();
            }
        };

        document.addEventListener("keydown", handleEscape);
        return () => document.removeEventListener("keydown", handleEscape);
    }, [open, onCancel]);

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center mt-20 2xl:mt-40">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/90"
                onClick={() => !deleting && onCancel()}
            />

            {/* Modal */}
            <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
                <div className="mb-4 flex items-start gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-rose-500/10">
                        <AlertTriangle className="h-5 w-5 text-rose-400" />
                    </div>
                    <div className="flex-1">
                        <h2 className="text-lg font-semibold text-slate-100">
                            Delete Webhook
                        </h2>
                        <p className="mt-1 text-sm text-slate-300">
                            Are you sure you want to delete{" "}
                            <span className="font-semibold text-slate-100">
                                {webhook.name}
                            </span>
                            ? This action cannot be undone and you will stop receiving{" "}
                            {provider.integration.name} notifications
                            from this webhook.
                        </p>
                    </div>
                </div>
                <div className="flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={deleting}
                        className="rounded-lg border border-slate-700 px-4 py-1.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                    >
                        Cancel
                    </button>

                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={deleting}
                        className="rounded-lg bg-rose-600 px-4 py-1.5 text-sm font-semibold text-slate-50 hover:bg-rose-500 disabled:opacity-60"
                    >
                        {deleting ? "Deleting…" : "Delete Webhook"}
                    </button>
                </div>
            </div>
        </div>
    );
}
