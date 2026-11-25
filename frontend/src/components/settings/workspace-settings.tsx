import React, { useState, useEffect } from "react";
import { getWorkspaces, renameWorkspace } from "../../services/api-service";
import { Modal } from "../ui/Modal";
import toast from "react-hot-toast";
import { useAuth } from "../../context/auth-context";

type WorkspaceSettingsProps = {
    workspaceName: string;
    canManage: boolean;
};

const WorkspaceSettings = ({ workspaceName, canManage }: WorkspaceSettingsProps) => {
    const [showModal, setShowModal] = useState(false);
    const [newName, setNewName] = useState(workspaceName);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (showModal) {
            setNewName(workspaceName);
            setError(null);
        }
    }, [showModal, workspaceName]);

    const isUnchanged = newName.trim() === workspaceName;
    const isInvalid = newName.trim().length < 3;

    const { persistAuth, token, user } = useAuth();

    const handleRename = async () => {
        if (isInvalid) {
            setError("Workspace name must be at least 3 characters.");
            return;
        }

        if (isUnchanged) {
            setError("New name must be different from current name.");
            return;
        }

        try {
            setLoading(true);
            setError(null);

            if (!newName)
                throw new Error("Workspace name cannot be empty.");

            await renameWorkspace(newName.trim());

            toast.success("Workspace renamed successfully");

            const updatedWorkspaces = await getWorkspaces();
            persistAuth(token!, user!, updatedWorkspaces);

            setShowModal(false);
        } catch (err) {
            console.error(err);
            setError("Failed to rename workspace. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-6 flex flex-col gap-4 md:flex-row items-start justify-between">
            <div>
                <h2 className="text-lg font-semibold text-slate-100">
                    Workspace
                </h2>
                <p className="text-sm text-slate-400 mb-4">
                    Manage your workspace information
                </p>
                <div className="mt-2 text-sm text-slate-300">
                    <span className="text-slate-400">Current name:</span>{" "}
                    <span className="font-medium">{workspaceName}</span>
                </div>
            </div>

            <div className="flex justify-end mt-4 md:mt-0">
                <button
                    onClick={() => setShowModal(true)}
                    disabled={!canManage}
                    className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 transition disabled:opacity-50 disabled:!cursor-not-allowed"
                >
                    Edit
                </button>
            </div>

            {showModal && (
                <Modal onClose={() => setShowModal(false)} title="Rename Workspace">
                    <form onSubmit={(e) => { e.preventDefault(); handleRename(); }} className="space-y-4" noValidate>
                        <div className="space-y-1">
                            <label className="text-sm text-slate-400">
                                Workspace name <span className="text-red-500 ml-1">*</span>
                            </label>
                            <input
                                autoFocus
                                value={newName}
                                onChange={(e) => {
                                    setNewName(e.target.value);
                                    setError(null);
                                }}
                                placeholder="Enter new workspace name"
                                className={`w-full rounded-lg border ${error ? 'border-red-500' : 'border-slate-700'} bg-slate-950 px-3 py-2 text-slate-100 placeholder-slate-500 focus:border-sky-500 focus:outline-none`}
                            />
                        </div>
                        {error && (
                            <p className="text-sm text-red-500">{error}</p>
                        )}
                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                disabled={loading || !canManage}
                                className="rounded-lg px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading || !canManage}
                                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-sky-500 transition"
                            >
                                {loading ? "Saving..." : "Save Changes"}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </section>
    );
};

export default WorkspaceSettings;