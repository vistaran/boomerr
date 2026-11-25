//
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { api } from "../../api";
import ManageMembersModal from "./manage-members-modal";
import { Users, UserPen, UserPlus, MailOpen, Clock, User, UserStar } from "lucide-react";
import { useDepartmentPendingInvitations, useDepartmentUsers } from "../../hooks/use-departments";
import { usePlanLimits, useTeamMembers } from "../../hooks";
import Tabs from "../common/Tabs";
import { cancelTeamInvite, resendTeamInvite } from "../../services/departments-service";
import { ConfirmModal } from "../common/confirm-modal";
import { PlanUpgradeModal } from "../common/plan-upgrade-modal";
import toast from "react-hot-toast";
import CommonLoader from "../common/common-loader";
import { useNavigate } from "react-router-dom";


type User = { ulid?: string; name: string; email: string; contact_email?: string | null; role?: string; pivot?: any };
type Invitation = {
    ulid: string;
    workspace_id: number;
    email: string;
    role: string;
    department_id: string;
    is_accepted: number;
    token: string;
    expires_at: string;
    created_at: string;
    updated_at: string;
};

type ModalType = null | 'manage' | 'invite';


function DepartmentMembers({ departmentId, workspaceId }: { departmentId: string; workspaceId: number }) {
    const navigate = useNavigate();
    const [openModal, setOpenModal] = useState<ModalType>(null);
    const [resendTimeouts, setResendTimeouts] = useState<Map<string, ReturnType<typeof setTimeout>>>(new Map());
    const [activeTab, setActiveTab] = useState<'members' | 'invitations'>('members');
    const [confirmCancelInviteOpen, setConfirmCancelInviteOpen] = useState(false);
    const [inviteToCancelId, setInviteToCancelId] = useState<string | null>(null);
    const [isCancelingInvite, setIsCancelingInvite] = useState(false);
    const [teamLimitModalOpen, setTeamLimitModalOpen] = useState(false);

    useEffect(() => {
        setActiveTab('members');
    }, [departmentId, workspaceId]);

    useEffect(() => {
        setOpenModal(null);
    }, [workspaceId]);

    const { data: department, isLoading: deptLoading } = useQuery<any>({
        queryKey: ["department", workspaceId, departmentId],
        queryFn: () => api.get(`/departments/${departmentId}`),
        enabled: !!departmentId && !!workspaceId,
    });

    const { data: departmentMembers = [], isLoading: membersLoading } = useDepartmentUsers(departmentId, workspaceId) as { data: User[] | undefined; isLoading: boolean };
    const { data: departmentInvites = [], isLoading: invitesLoading, refetch: refetchInvites } = useDepartmentPendingInvitations(departmentId, workspaceId) as { data: Invitation[] | undefined; isLoading: boolean; refetch: () => Promise<any> };
    const { data: teamMembers = [] } = useTeamMembers();
    const { canAddTeamMember, limits: planLimits } = usePlanLimits();

    const isLoading = deptLoading || membersLoading || invitesLoading;
    const nonOwnerCount = teamMembers.filter(m => m.role !== "owner").length;
    const atTeamLimit =
        typeof canAddTeamMember === "function"
            ? !canAddTeamMember(nonOwnerCount)
            : !canAddTeamMember;

    // Tab config for reusable Tabs component
    const tabs = [
        { key: 'members', label: 'Members' + (departmentMembers.length > 0 ? ` (${departmentMembers.length})` : '') },
        { key: 'invitations', label: 'Pending Invitations' + (departmentInvites.length > 0 ? ` (${departmentInvites.length})` : '') },
    ];

    const resendInvite = async (id: string) => {
        try {
            const res = await resendTeamInvite(id);
            if (res.success) {
                toast.success("Invitation resent successfully.");

                // Disable resend invite button for 2 minutes
                setResendTimeouts(prev => new Map(prev).set(id, setTimeout(() => { }, 2 * 60 * 1000)));
            }
        } catch (error) {
            console.error("Error resending invite:", error);
        }
    };

    const onRequestCancelInvite = (id: string) => {
        setInviteToCancelId(id);
        setConfirmCancelInviteOpen(true);
    };

    const onConfirmCancelInvite = async () => {
        if (inviteToCancelId == null) return;

        try {
            setIsCancelingInvite(true);
            const res = await cancelTeamInvite(inviteToCancelId);

            setConfirmCancelInviteOpen(false);
            setInviteToCancelId(null);

            if (res.success) {
                toast.success("Invitation canceled successfully.");
                if (typeof refetchInvites === 'function') {
                    refetchInvites();
                }
            }
        } catch (error) {
            console.error("Error canceling invite:", error);
            toast.error("Failed to cancel the invitation. Please try again after some time.");
        } finally {
            setIsCancelingInvite(false);
        }
    };

    const onCancelCancelInvite = () => {
        setConfirmCancelInviteOpen(false);
        setInviteToCancelId(null);
    };

    const onInviteClick = () => {
        if (atTeamLimit) {
            setTeamLimitModalOpen(true);
            return;
        }
        setOpenModal('invite');
    };

    return (
        <>
            {isLoading ? (
                <div className="flex justify-center items-center h-full bg-slate-950/80">
                    <CommonLoader />
                </div>
            ) : (
                <div className="bg-slate-950/80 w-full p-4 h-full flex flex-col shadow-lg">
                    <div className="flex flex-wrap gap-2 justify-between items-center mb-4">
                        <h2 className="flex items-center text-2xl font-bold">
                            <Users className="mr-2" />
                            <span>{department?.name} Members</span>
                        </h2>
                        <div className="flex gap-3">
                            <button
                                onClick={onInviteClick}
                                className="flex items-center gap-2 text-white rounded-lg bg-gradient-to-r from-sky-500 to-indigo-500 px-2 py-1"
                            >
                                <UserPlus size={16} /> Invite Member
                            </button>
                            <button
                                onClick={() => setOpenModal('manage')}
                                className="flex items-center gap-2 rounded-lg border px-2 py-1"
                            >
                                <UserPen size={16} /> Manage Members
                            </button>
                        </div>
                    </div>

                    {/* Reusable Tabs */}
                    <div className="mb-4">
                        <Tabs
                            tabs={tabs}
                            activeTab={activeTab}
                            onTabChange={key => setActiveTab(key as 'members' | 'invitations')}
                        >
                            {/* No tab children needed here */}
                        </Tabs>
                    </div>

                    {/* Tab Content */}
                    {activeTab === 'members' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 2xl:grid-cols-4 gap-4">
                            {(departmentMembers ?? []).length === 0 ? (
                                <div className="col-span-full text-center text-slate-400">No members found.</div>
                            ) : (
                                departmentMembers.map((user: User) => (
                                    <div
                                        key={user.ulid}
                                        className="rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-800 p-3 shadow-lg flex flex-col gap-2"
                                    >
                                        <div className="flex justify-between items-center gap-2">
                                            <div className="min-w-0 flex items-center gap-2">
                                                    {user.role == "admin" ? <UserStar className="text-sky-400" size={22} /> : <User className="text-sky-400" size={22} />}
                                                    <span className="font-semibold text-md text-slate-100 truncate">{user.name}</span>
                                                </div>
                                            {user.role && (
                                                <span className="text-xs inline-block flex-shrink-0 bg-sky-800/60 text-sky-200 px-2 py-1 rounded">
                                                    {user.role}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-sm text-slate-400 flex items-center gap-1">
                                            <MailOpen className="w-4 h-4 mr-1 text-slate-500" />
                                            {user.contact_email || user.email}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {activeTab === 'invitations' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 2xl:lg:grid-cols-4 gap-4">
                            {(departmentInvites ?? []).length === 0 ? (
                                <div className="col-span-full text-center text-slate-400 py-8">
                                    No pending invitations.
                                </div>
                            ) : (
                                (departmentInvites ?? []).map((invite: Invitation) => (
                                    <div
                                        key={invite.ulid}
                                        className="
                                            group relative
                                            rounded-xl border border-slate-700
                                            bg-gradient-to-br from-slate-900/80 to-slate-800/80
                                            p-4
                                            shadow-sm
                                            transition-all duration-200
                                            hover:border-sky-600/60
                                            hover:shadow-md
                                            focus-within:ring-2 focus-within:ring-sky-500">
                                        {/* Header */}
                                        <div className="flex items-start gap-3">
                                            <div className="
                                                flex h-8 w-8 items-center justify-center
                                                rounded-lg bg-sky-900/40
                                                text-sky-400">
                                                <MailOpen size={16} />
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium text-slate-100 truncate">
                                                    {invite.email}
                                                </p>
                                                <p className="mt-0.5 text-xs text-slate-400">
                                                    Pending invitation
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 mt-3">
                                            <button className="text-sm font-medium text-sky-300 hover:text-sky-400 disabled:opacity-50 disabled:cursor-not-allowed"
                                                disabled={resendTimeouts.has(invite.ulid)}
                                                onClick={() => resendInvite(invite.ulid)}>Resend Invite</button>
                                            <button className="text-sm font-medium text-rose-300 hover:text-rose-400" onClick={() => onRequestCancelInvite(invite.ulid)}>Cancel Invite</button>
                                        </div>

                                        {/* Meta */}
                                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                                            <span className="
                                                inline-flex items-center rounded-md
                                                bg-sky-800/60 px-2 py-0.5
                                                font-medium text-sky-300">
                                                {invite.role}
                                            </span>

                                            <span className="inline-flex items-center gap-1 text-slate-400">
                                                <Clock className="h-3 w-3 text-sky-400" />
                                                <span>
                                                    Expires&nbsp;
                                                    {new Date(invite.expires_at).toLocaleDateString()}
                                                </span>
                                            </span>
                                        </div>

                                        {/* Subtle bottom accent */}
                                        <div className="
                                            pointer-events-none absolute inset-x-0 bottom-0 h-px
                                            bg-gradient-to-r from-transparent via-sky-600/40 to-transparent
                                            opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                ))
                            )}

                        </div>
                    )}
                </div>
            )}

            {
                openModal === 'manage' && (
                    <ManageMembersModal
                        departmentId={departmentId}
                        workspaceId={workspaceId}
                        onClose={() => setOpenModal(null)}
                        inviteMode={false}
                    />
                )
            }

            {
                openModal === 'invite' && (
                    <ManageMembersModal
                        departmentId={departmentId}
                        workspaceId={workspaceId}
                        onClose={() => setOpenModal(null)}
                        inviteMode={true}
                        onInviteSuccess={() => setActiveTab('invitations')}
                    />
                )
            }
            {/* Confirmation modal for canceling an invite */}
            <ConfirmModal
                open={confirmCancelInviteOpen}
                title="Cancel Invitation"
                description={
                    inviteToCancelId != null ? (
                        <span className="text-slate-300">This will revoke the pending invite. Are you sure?</span>
                    ) : (
                        <span className="text-slate-300">Are you sure you want to cancel this invitation?</span>
                    )
                }
                confirmLabel="Cancel Invite"
                cancelLabel="Keep"
                confirming={isCancelingInvite}
                onConfirm={onConfirmCancelInvite}
                onCancel={onCancelCancelInvite}
                tone="danger"
            />

            <PlanUpgradeModal
                open={teamLimitModalOpen}
                onClose={() => setTeamLimitModalOpen(false)}
                onUpgrade={() => {
                    setTeamLimitModalOpen(false);
                    navigate('/billing');
                }}
                title="Team Member Limit Reached"
                featureLabel="team invitations"
                limitMessage={`Your plan allows up to ${planLimits.max_team_members ?? 0} team member${(planLimits.max_team_members ?? 0) === 1 ? "" : "s"
                    }. Upgrade to invite more.`}
                upgradeLabel="Upgrade to Invite"
            />
        </>
    );
}

export default DepartmentMembers;
