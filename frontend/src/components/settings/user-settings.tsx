import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/auth-context";
import { Modal } from "../ui/Modal";
import toast from "react-hot-toast";
import { updateUserInfo } from "../../services/api-service";
import { User as UserIcon, Mail } from "lucide-react";

const UserSettings = () => {
    const { user, token, workspaces, persistAuth } = useAuth();
    const [showModal, setShowModal] = useState(false);
    const [name, setName] = useState(user?.name ?? "");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (!showModal) return;
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setShowModal(false);
            }
        };
        document.addEventListener("keydown", handleEscape);
        return () => document.removeEventListener("keydown", handleEscape);
    }, [showModal]);

    const handleSave = async () => {
        const newErrors: Record<string, string> = {};
        if (!name.trim()) newErrors.name = "Name is required";
        else if (name.trim().length < 2) newErrors.name = "Name must be at least 2 characters";

        setErrors(newErrors);

        if (Object.keys(newErrors).length > 0) return;

        setLoading(true);
        setError(null);
        try {
            await updateUserInfo(name.trim());

            // refresh user data in context
            persistAuth(token!, { ...user!, name: name.trim() }, workspaces);

            toast.success("User info updated!");
            setShowModal(false);
        } catch (e) {
            console.error(e);
            setError("Failed to update user info.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-6 flex flex-col justify-between">
            <div>
                <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-100 mb-1">Profile</h2>
                        <p className="text-sm text-slate-400">Manage your personal profile details.</p>
                    </div>
                    <button
                        onClick={() => {
                            setName(user?.name ?? "");
                            setErrors({});
                            setShowModal(true);
                        }}
                        className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 transition flex-shrink-0"
                    >
                        Edit
                    </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-300 text-sm">
                    <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3">
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                            <UserIcon size={13} />
                            <span>Name</span>
                        </div>
                        <span className="font-medium text-slate-100 block truncate">{user?.name || "—"}</span>
                    </div>
                    <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3">
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                            <Mail size={13} />
                            <span>Email</span>
                        </div>
                        <span className="font-medium text-slate-100 block truncate" title={user?.email}>{user?.email || "—"}</span>
                    </div>
                </div>
            </div>

            {showModal && (
                <Modal onClose={() => setShowModal(false)} title="Edit User Info">
                    <form
                        className="space-y-4"
                        noValidate
                        onSubmit={e => {
                            e.preventDefault();
                            handleSave();
                        }}
                    >
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">
                                Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={e => {
                                    setName(e.target.value);
                                    if (errors.name) setErrors({ ...errors, name: "" });
                                }}
                                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                            />
                            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                        </div>
                        {error && <p className="text-sm text-red-500">{error}</p>}
                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                disabled={loading}
                                className="rounded-lg px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 transition"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading || name.trim().length < 2}
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

export default UserSettings;
