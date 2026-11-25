import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { api } from "../../api";
import { Modal } from "../ui/Modal";
import { useSendInvitation } from "../../hooks";

type ManageMembersModalProps = {
    departmentId: string;
    workspaceId: number;
    onClose: () => void;
    inviteMode?: boolean;
    onInviteSuccess?: () => void;
};

function ManageMembersModal({ departmentId, workspaceId, onClose, inviteMode = false, onInviteSuccess }: ManageMembersModalProps) {
    type User = { ulid?: string; name: string; email: string };

    const queryClient = useQueryClient();

    const { data: allUsers } = useQuery<{ data: User[] }>({
        queryKey: ["all-users", workspaceId],
        queryFn: () => api.get("/team/members"),
        enabled: !!workspaceId,
    });

    const { data: deptUsers } = useQuery<User[]>({
        queryKey: ["department-users", workspaceId, departmentId],
        queryFn: () => api.get(`/departments/${departmentId}/users`),
        enabled: !!departmentId && !!workspaceId,
    });

    const [selected, setSelected] = useState<string[]>([]);

    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteRole, setInviteRole] = useState("member");
    const [inviteError, setInviteError] = useState<string | null>(null);
    const [emailTouched, setEmailTouched] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const filteredUsers = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();
        const list = allUsers?.data ?? [];
        if (!query) return list;
        return list.filter(({ name, email }) =>
            name?.toLowerCase().includes(query) || email?.toLowerCase().includes(query)
        );
    }, [allUsers, searchTerm]);
    const sendInvitationMutation = useSendInvitation();

    useEffect(() => {
        if (!open) return;

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onClose();
            }
        };

        document.addEventListener("keydown", handleEscape);
        return () => document.removeEventListener("keydown", handleEscape);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (deptUsers) {
            setSelected(deptUsers.map(u => u.ulid));
        }
    }, [deptUsers]);

    const toggle = (id: string) => {
        setSelected(prev =>
            prev.includes(id)
                ? prev.filter(i => i !== id)
                : [...prev, id]
        );
    };

    const isValidEmail = (email: string) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };

    useEffect(() => {
        if (!inviteMode) return;
        if (!emailTouched) {
            setInviteError(null);
            return;
        }
        if (!inviteEmail.trim()) {
            setInviteError("Email is required.");
        } else if (!isValidEmail(inviteEmail.trim())) {
            setInviteError("Invalid email address.");
        } else {
            setInviteError(null);
        }
    }, [inviteEmail, inviteRole, inviteMode, emailTouched]);

    const validateInvite = () => {
        setEmailTouched(true);
        if (!inviteEmail.trim()) {
            setInviteError("Email is required.");
            return false;
        } else if (!isValidEmail(inviteEmail.trim())) {
            setInviteError("Invalid email address.");
            return false;
        }
        setInviteError(null);
        return true;
    };

    const save = async () => {
        const payload = {
            email: inviteEmail,
            role: inviteRole,
            isFromDepartment: true,
            department_id: departmentId
        };
        if (inviteMode) {
            if (!validateInvite()) return;
            await sendInvitationMutation.mutateAsync(payload);
            await queryClient.invalidateQueries({
                queryKey: ["department-pending-invitations", workspaceId, departmentId],
            });
            await queryClient.invalidateQueries({
                queryKey: ["department-users", workspaceId, departmentId],
            });
            onInviteSuccess?.();
            onClose();
            return;
        }
        if (!inviteMode) {
            await api.post(`/departments/${departmentId}/users`, {
                department_id: departmentId,
                user_ids: selected,
                workspace_id: workspaceId,
            });
        }

        await queryClient.invalidateQueries({
            queryKey: ["department-users", workspaceId, departmentId],
        });

        await queryClient.invalidateQueries({
            queryKey: ["departments", workspaceId],
        });

        onClose();
    };

    return (
        <>
            <Modal title={inviteMode ? `Invite Member to department` : "Manage Members"} onClose={onClose}>
                <form 
                    onSubmit={(e) => { 
                        e.preventDefault(); 
                        save(); 
                    }} 
                    noValidate
                >

                {inviteMode ? (
                    <div className="max-h-80 overflow-y-auto space-y-2 bg-slate-900 rounded-xl p-2">
                        <div className="flex flex-col gap-4 mb-4">
                            <label className="flex flex-col gap-1">
                                <span className="text-slate-200 font-medium">Email address</span>
                                <input
                                    type="email"
                                    required
                                    placeholder="Enter email address"
                                    value={inviteEmail}
                                    onChange={e => setInviteEmail(e.target.value)}
                                    onBlur={() => setEmailTouched(true)}
                                    className={`px-3 py-2 rounded-lg mb-1 border ${inviteError ? 'border-red-500' : 'border-slate-700'} bg-slate-800 text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 transition`}
                                />
                                {emailTouched && inviteError && <span className="text-xs text-red-400 mt-1">{inviteError}</span>}
                            </label>
                            <label className="flex flex-col gap-1">
                                <span className="text-slate-200 font-medium">Role</span>
                                <select
                                    value={inviteRole}
                                    onChange={e => setInviteRole(e.target.value)}
                                    className="px-3 py-2 rounded-lg mb-1 border border-slate-700 bg-slate-800 text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 transition"
                                >
                                    <option value="member">Member</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </label>
                            <button
                                type="submit"
                                className="px-5 py-2 rounded-lg bg-gradient-to-r from-sky-600 to-indigo-600 text-white font-semibold hover:scale-102 transition disabled:opacity-60"
                            >
                                Invite
                            </button>
                        </div>
                    </div>
                ) :
                    <>
                        <div className="max-h-88 overflow-y-auto space-y-2 bg-slate-900 rounded-xl p-2">
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                placeholder="Search by name or email"
                                className="w-full mb-3 px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                            />
                            {filteredUsers.length ? (
                                filteredUsers.map((u: User) => (
                                    <label
                                        key={u.ulid}
                                        className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 cursor-pointer hover:bg-slate-700"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selected.includes(u.ulid)}
                                            onChange={() => toggle(u.ulid)}
                                            className="accent-sky-500 w-4 h-4"
                                        />
                                        <div className="flex flex-col">

                                            <span className="text-slate-100 font-medium">
                                                {u.name}
                                            </span>
                                            <span className="text-sm text-slate-400">
                                                ({u.email})
                                            </span>
                                        </div>
                                    </label>
                                ))
                            ) : (
                                <p className="text-center text-sm text-slate-400 py-4">No members found.</p>
                            )}
                        </div>

                        <div className="flex justify-end mt-3">
                            <button
                                type="submit"
                                className="px-5 py-2 rounded-lg bg-gradient-to-r from-sky-600 to-indigo-600 text-white font-semibold hover:from-sky-500 hover:to-indigo-500"
                            >
                                Save
                            </button>
                        </div>
                    </>
                }
                </form>

            </Modal>
        </>
    );
}

export default ManageMembersModal;
