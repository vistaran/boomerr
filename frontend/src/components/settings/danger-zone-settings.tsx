import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/auth-context";
import { Modal } from "../ui/Modal";
import toast from "react-hot-toast";
import { deleteUserAccount } from "../../services/api-service";
import { AlertTriangle, Trash2, Loader2, UserX, Building2, Users } from "lucide-react";

const DangerZoneSettings = () => {
    const { logout } = useAuth();
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState("");
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    useEffect(() => {
        if (!showDeleteModal) return;
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setShowDeleteModal(false);
            }
        };
        document.addEventListener("keydown", handleEscape);
        return () => document.removeEventListener("keydown", handleEscape);
    }, [showDeleteModal]);

    const isDeleteConfirmed = deleteConfirmText.trim().toUpperCase() === "DELETE";

    const handleDeleteAccount = async () => {
        if (!isDeleteConfirmed) {
            setDeleteError('Please type "DELETE" to confirm account deletion.');
            return;
        }

        setDeleting(true);
        setDeleteError(null);

        try {
            await deleteUserAccount();
            toast.success("Your account has been deleted.");
            setShowDeleteModal(false);
            logout();
            window.location.href = "/login";
        } catch (e: any) {
            console.error("Account deletion failed:", e);
            setDeleteError(e?.message || "Failed to delete account. Please try again.");
        } finally {
            setDeleting(false);
        }
    };

    return (
        <section className="rounded-2xl border border-rose-900/30 bg-slate-950/80 p-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <AlertTriangle size={16} />
                        </div>
                        <h2 className="text-lg font-semibold text-rose-400">Danger Zone</h2>
                    </div>
                    <p className="text-sm text-slate-400 max-w-2xl">
                        Permanently delete your account, notification history, and any workspaces you own. Once confirmed, this action cannot be undone.
                    </p>
                </div>

                <div className="flex items-center">
                    <button
                        type="button"
                        onClick={() => {
                            setDeleteConfirmText("");
                            setDeleteError(null);
                            setShowDeleteModal(true);
                        }}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm font-medium text-rose-400 hover:bg-rose-500/20 hover:border-rose-500/50 transition shadow-sm"
                    >
                        <Trash2 size={15} />
                        Delete Account
                    </button>
                </div>
            </div>

            {/* Delete Account Confirmation Modal */}
            {showDeleteModal && (
                <Modal
                    onClose={() => {
                        if (!deleting) setShowDeleteModal(false);
                    }}
                    title={
                        <div className="flex items-center gap-2">
                            <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400">
                                <Trash2 size={18} />
                            </div>
                            <span className="text-base font-semibold text-slate-100">Delete Account Permanently</span>
                        </div>
                    }
                    width="lg"
                >
                    <div className="space-y-4 pt-1">
                        <div className="rounded-xl border border-rose-500/25 bg-rose-950/20 p-4 space-y-3">
                            <div className="flex items-center gap-2 text-rose-300 font-semibold text-xs sm:text-sm">
                                <AlertTriangle size={16} className="text-rose-400 flex-shrink-0" />
                                <span>Warning: This action is permanent and cannot be undone</span>
                            </div>

                            <div className="space-y-2 text-xs">
                                <div className="flex items-start gap-3 rounded-lg bg-rose-500/10 border border-rose-500/15 p-2.5">
                                    <div className="p-1 rounded bg-rose-500/20 text-rose-300 mt-0.5 flex-shrink-0">
                                        <UserX size={14} />
                                    </div>
                                    <div className="leading-relaxed">
                                        <span className="font-semibold text-rose-200">Account & History:</span>{" "}
                                        <span className="text-slate-300">Your profile, login access, and all notification records will be permanently erased.</span>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3 rounded-lg bg-rose-500/10 border border-rose-500/15 p-2.5">
                                    <div className="p-1 rounded bg-rose-500/20 text-rose-300 mt-0.5 flex-shrink-0">
                                        <Building2 size={14} />
                                    </div>
                                    <div className="leading-relaxed">
                                        <span className="font-semibold text-rose-200">Owned Workspaces:</span>{" "}
                                        <span className="text-slate-300">Any workspace you own will be completely deleted with its monitored domains, and all team members will be removed.</span>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3 rounded-lg bg-rose-500/10 border border-rose-500/15 p-2.5">
                                    <div className="p-1 rounded bg-rose-500/20 text-rose-300 mt-0.5 flex-shrink-0">
                                        <Users size={14} />
                                    </div>
                                    <div className="leading-relaxed">
                                        <span className="font-semibold text-rose-200">Shared Workspaces:</span>{" "}
                                        <span className="text-slate-300">Workspaces where you are just a member remain unaffected for others; only your personal access is removed.</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-xs font-medium text-slate-300">
                                To confirm, please type <span className="font-bold text-white bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">DELETE</span> in the box below:
                            </label>
                            <input
                                type="text"
                                value={deleteConfirmText}
                                onChange={e => {
                                    setDeleteConfirmText(e.target.value);
                                    if (deleteError) setDeleteError(null);
                                }}
                                onPaste={e => e.preventDefault()}
                                onDrop={e => e.preventDefault()}
                                autoComplete="off"
                                placeholder="DELETE"
                                disabled={deleting}
                                autoFocus
                                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-rose-500 focus:outline-none"
                            />
                            {deleteError && <p className="text-xs text-rose-400">{deleteError}</p>}
                        </div>

                        <div className="flex justify-end gap-2.5 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowDeleteModal(false)}
                                disabled={deleting}
                                className="rounded-lg px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 transition disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleDeleteAccount}
                                disabled={!isDeleteConfirmed || deleting}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-medium text-white hover:bg-rose-500 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-rose-950"
                            >
                                {deleting ? (
                                    <>
                                        <Loader2 size={13} className="animate-spin" />
                                        Deleting Account...
                                    </>
                                ) : (
                                    <>
                                        <Trash2 size={13} />
                                        Permanently Delete Account
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </section>
    );
};

export default DangerZoneSettings;
