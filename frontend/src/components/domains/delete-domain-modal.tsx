import type { ReactNode } from "react";
import { ConfirmModal } from "../common/confirm-modal";
import type { Domain } from "../../types/domains";

interface DeleteDomainModalProps {
    open: boolean;
    domain?: Domain | null;
    deleting: boolean;
    onCancel: () => void;
    onConfirm: () => void;
    title?: string;
    description?: ReactNode;
    confirmLabel?: string;
}

export function DeleteDomainModal({
    open,
    domain = null,
    deleting,
    onCancel,
    onConfirm,
    title,
    description,
    confirmLabel,
}: DeleteDomainModalProps) {
    const heading = title ?? "Delete Domain";
    const actionLabel = confirmLabel ?? "Delete";
    const descriptionContent = description ?? (
        domain ? (
            <>
                This will permanently remove {" "}
                <span className="font-semibold text-slate-100">{domain.name}</span>{" "}
                from monitoring. SSL and uptime history will be discarded.
            </>
        ) : (
            "Are you sure you want to continue?"
        )
    );

    return (
        <ConfirmModal
            open={open}
            title={heading}
            description={descriptionContent}
            confirmLabel={actionLabel}
            cancelLabel="Cancel"
            confirming={deleting}
            onCancel={onCancel}
            onConfirm={onConfirm}
            tone="danger"
        />
    );
}
