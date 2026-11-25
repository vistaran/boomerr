import { useState } from "react";
import { PlusIcon, X } from "lucide-react";

type InviteMemberModalProps = {
    open: boolean;
    onClose: () => void;
    onInvite: (email: string, role: string) => Promise<void>;
    loading: boolean;
};

export function InviteMemberModal({ open, onClose, onInvite, loading }: InviteMemberModalProps) {
    const [email, setEmail] = useState("");
    const [role, setRole] = useState("member");
    const [errors, setErrors] = useState<Record<string, string>>({});

    if (!open) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const newErrors: Record<string, string> = {};
        if (!email.trim()) newErrors.email = "Email Address is required";
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = "Invalid email format";
        if (!role) newErrors.role = "Role is required";

        setErrors(newErrors);
        
        if (Object.keys(newErrors).length > 0) return;

        await onInvite(email, role);
        setEmail("");
        setRole("member");
    };

    const handleClose = () => {
        if (loading) return;
        setEmail("");
        setRole("member");
        setErrors({});
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
            <div className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
                <button
                    onClick={handleClose}
                    disabled={loading}
                    className="absolute right-4 top-4 rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100 disabled:opacity-50"
                >
                    <X size={20} />
                </button>
                <span className="mb-2 flex items-center gap-1">
                    <PlusIcon className="inline-block font-bold mb-1" />
                    <h2 className="mb-1 text-xl font-semibold text-slate-50">Invite Team Member</h2>
                </span>
                <p className="mb-6 text-sm text-slate-400">
                    Send an invitation to join your workspace.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                    <div>
                        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-300">
                            Email Address <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="email"
                            type="email"
                            placeholder="member@example.com"
                            value={email}
                            onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors({...errors, email: ''}); }}
                            disabled={loading}
                            className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 disabled:opacity-50"
                        />
                        {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                    </div>

                    <div>
                        <label htmlFor="role" className="mb-1.5 block text-sm font-medium text-slate-300">
                            Role <span className="text-red-500">*</span>
                        </label>
                        <select
                            id="role"
                            value={role}
                            onChange={(e) => { setRole(e.target.value); if (errors.role) setErrors({...errors, role: ''}); }}
                            disabled={loading}
                            className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 disabled:opacity-50"
                        >
                            <option value="member">Member</option>
                            <option value="admin">Admin</option>
                        </select>
                        {errors.role && <p className="text-red-500 text-xs mt-1">{errors.role}</p>}
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={handleClose}
                            disabled={loading}
                            className="flex-1 rounded-full border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-800 hover:text-slate-100 disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 rounded-full border border-sky-500/60 bg-sky-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-sky-400 disabled:opacity-60"
                        >
                            {loading ? "Sending…" : "Send Invitation"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
