import { useState } from "react";
import toast from "react-hot-toast";
import { DeleteDomainModal } from "../components/domains/delete-domain-modal";
import { InviteMemberModal } from "../components/teams/invite-member-modal";
import type { User } from '../types/user';
import {
    useTeamMembers,
    usePendingInvitations,
    useSendInvitation,
    useRemoveTeamMember,
    usePlanLimits,
    type TeamMember,
} from "../hooks";
import { Users, UserPlus, Lock } from "lucide-react";
import { PlanUpgradeModal } from "../components/common/plan-upgrade-modal";
import { useNavigate } from "react-router-dom";

type TeamsPageProps = {
    currentUser: User;
};

export function TeamsPage({ currentUser }: TeamsPageProps) {
    const navigate = useNavigate();
    const canManage = ["owner", "admin"].includes(currentUser.role ?? "");
    const [activeTab, setActiveTab] = useState<"members" | "invitations">("members");
    const [memberPendingRemoval, setMemberPendingRemoval] = useState<TeamMember | null>(null);
    const [inviteModalOpen, setInviteModalOpen] = useState(false);
    const [teamLimitModalOpen, setTeamLimitModalOpen] = useState(false);

    // React Query hooks
    const { data: members = [], isLoading: membersLoading } = useTeamMembers();
    const { data: pendingInvitations = [] } = usePendingInvitations();
    const sendInvitationMutation = useSendInvitation();
    const removeTeamMemberMutation = useRemoveTeamMember();

    // Plan limits
    const { canAddTeamMember, limits: planLimits } = usePlanLimits();
    // non-owner members count
    const nonOwnerCount = members.filter(m => m.role !== "owner").length;
    const atTeamLimit =
        typeof canAddTeamMember === "function"
            ? !canAddTeamMember(nonOwnerCount)
            : !canAddTeamMember;

    const openTeamLimitModal = () => {
        setInviteModalOpen(false);
        setTeamLimitModalOpen(true);
    };

    const handleInvite = async (email: string, role: string) => {
        if (!canManage) {
            toast.error("You don't have permission to invite teammates.");
            return;
        }
        if (atTeamLimit) {
            openTeamLimitModal();
            return;
        }

        try {
            await sendInvitationMutation.mutateAsync({ email, role, isFromDepartment: false });
            setInviteModalOpen(false);
        } catch {
            // Error handling is done in the mutation hook
        }
    };

    const requestMemberRemoval = (member: TeamMember) => {
        if (!canManage) return;
        if (member.id === currentUser.id) {
            toast.error("You cannot remove yourself from the workspace.");
            return;
        }

        setMemberPendingRemoval(member);
    };

    const closeRemoveModal = () => {
        if (removeTeamMemberMutation.isPending) return;
        setMemberPendingRemoval(null);
    };

    const handleRemoveMemberConfirm = async () => {
        if (!memberPendingRemoval) return;

        try {
            await removeTeamMemberMutation.mutateAsync(memberPendingRemoval.id);
            setMemberPendingRemoval(null);
        } catch {
            // Error handling is done in the mutation hook
        }
    };

    return (
        <div className="space-y-6">
            <section className="rounded-2xl">
                <h1 className="text-xl tracking-tight text-slate-50 flex items-center gap-2">
                    <div className="rounded-xl bg-gradient-to-br from-sky-500 to-indigo-500 p-2.5 shadow-lg shadow-sky-500/20">
                        <Users size={24} />
                    </div>
                    Team Management
                </h1>
                <p className="mt-1 text-sm text-slate-300">
                    Invite teammates and keep track of pending invitations.
                </p>
                {!canManage && (
                    <p className="mt-2 text-sm text-slate-400">
                        You have read-only access. Only workspace owners and admins can send invitations.
                    </p>
                )}
            </section>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex gap-2">
                        {(["members", "invitations"] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${activeTab === tab
                                    ? "bg-sky-500 text-slate-950"
                                    : "border border-slate-700 text-slate-300 hover:text-slate-100"
                                    }`}
                            >
                                {tab === "members" ? "Members" : "Pending Invitations"}
                            </button>
                        ))}
                    </div>

                    {canManage && (
                        atTeamLimit ? (
                            <button
                                type="button"
                                onClick={openTeamLimitModal}
                                className="inline-flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-400 hover:bg-amber-500/20 transition-colors"
                                title={`Your plan allows up to ${planLimits.max_team_members ?? 0} team member(s). Upgrade to invite more.`}
                            >
                                <Lock size={14} />
                                Upgrade to Invite
                            </button>
                        ) : (
                            <button
                                onClick={() => setInviteModalOpen(true)}
                                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-sky-500 to-indigo-500 px-3 py-2 text-sm font-bold text-white shadow hover:scale-105"
                            >
                                <UserPlus size={16} />
                                Invite Member
                            </button>
                        )
                    )}
                </div>

                {activeTab === "members" ? (
                    <div className="mt-6">
                        {membersLoading ? (
                            <p className="text-sm text-slate-400">Loading members…</p>
                        ) : members.length === 0 ? (
                            <p className="text-sm text-slate-400">No members found for this workspace.</p>
                        ) : (
                            <ul className="divide-y divide-slate-800/80">
                                {members.map((member) => (
                                    <li
                                        key={member.id}
                                        className="flex flex-col gap-3 py-3 text-sm text-slate-200 sm:flex-row sm:items-center sm:justify-between"
                                    >
                                        <div>
                                            <p className="font-semibold text-slate-100">{member.name}</p>
                                            <p className="text-sm text-slate-400">{member.contact_email || member.email}</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="rounded-full border border-slate-700 px-3 py-1 text-sm uppercase tracking-wide text-slate-300">
                                                {member.role}
                                            </span>
                                            {canManage && member.role !== "owner" && member.id !== currentUser.id && (
                                                <button
                                                    onClick={() => requestMemberRemoval(member)}
                                                    disabled={removeTeamMemberMutation.isPending}
                                                    className="rounded-full border border-rose-500/50 px-3 py-1 text-sm font-semibold text-rose-300 hover:bg-rose-500/10 disabled:opacity-60"
                                                >
                                                    {removeTeamMemberMutation.isPending && memberPendingRemoval?.id === member.id
                                                        ? "Removing…"
                                                        : "Remove"}
                                                </button>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                ) : (
                    <div className="mt-6">
                        {pendingInvitations.length > 0 ? (
                            <ul className="divide-y divide-slate-800/80">
                                {pendingInvitations.map((invitation) => (
                                    <li key={invitation.ulid} className="flex items-center justify-between py-3 text-sm text-slate-200">
                                        <span className="font-medium text-slate-100">{invitation.email}</span>
                                        <span className="rounded-full border border-slate-700 px-3 py-1 text-sm uppercase tracking-wide text-slate-300">
                                            {invitation.role}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-slate-400">No pending invitations.</p>
                        )}
                    </div>
                )}
            </div>

            <InviteMemberModal
                open={inviteModalOpen}
                onClose={() => setInviteModalOpen(false)}
                onInvite={handleInvite}
                loading={sendInvitationMutation.isPending}
            />

            <PlanUpgradeModal
                open={teamLimitModalOpen}
                onClose={() => setTeamLimitModalOpen(false)}
                onUpgrade={() => {
                    setTeamLimitModalOpen(false);
                    navigate("/billing");
                }}
                title="Team Member Limit Reached"
                featureLabel="team invitations"
                limitMessage={`Your plan allows up to ${planLimits.max_team_members ?? 0} team member${
                    (planLimits.max_team_members ?? 0) === 1 ? "" : "s"
                }. Upgrade to invite more.`}
                upgradeLabel="Upgrade to Invite"
            />

            {canManage && (
                <DeleteDomainModal
                    open={Boolean(memberPendingRemoval)}
                    domain={null}
                    deleting={removeTeamMemberMutation.isPending}
                    onCancel={closeRemoveModal}
                    onConfirm={handleRemoveMemberConfirm}
                    title="Remove Team Member"
                    confirmLabel="Remove"
                    description={
                        memberPendingRemoval ? (
                            <>
                                You are about to remove{" "}
                                <span className="font-semibold text-slate-100">{memberPendingRemoval.name}</span>
                                {memberPendingRemoval.email && (
                                    <>
                                        {" "}
                                        <span className="text-slate-400">({memberPendingRemoval.contact_email || memberPendingRemoval.email})</span>
                                    </>
                                )}
                                {" "}
                                from this workspace. They will lose access immediately.
                            </>
                        ) : undefined
                    }
                />
            )}
        </div>
    );
}
