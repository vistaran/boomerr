import { type FormEvent, useCallback, useEffect, useState, lazy, Suspense } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
    useDomains,
    useCreateDomain,
    useUpdateDomain,
    useDeleteDomain,
    usePlanLimits,
    type DomainPayload,
} from "../hooks";

import { DomainsTable } from "../components/domains/domains-table";
import type { DomainFormState } from "../components/domains/add-domain-table";
import { Globe } from "lucide-react";
import type { User } from "../types/user";
import type { Domain } from "../types/domains";

const AddDomainModal = lazy(() => import("../components/domains/add-domain-table").then(m => ({ default: m.AddDomainModal })));
const DeleteDomainModal = lazy(() => import("../components/domains/delete-domain-modal").then(m => ({ default: m.DeleteDomainModal })));
const PlanUpgradeModal = lazy(() => import("../components/common/plan-upgrade-modal").then(m => ({ default: m.PlanUpgradeModal })));

type OverviewPageProps = {
    currentUser: User;
};

export function OverviewPage({ currentUser }: OverviewPageProps) {
    const defaultFormState = (): DomainFormState => ({
        name: "",
        url: "",
        label: "",
        environment: "production",
        is_active: true,
    });

    const canManage = ["owner", "admin"].includes(currentUser.role ?? "");
    const navigate = useNavigate();

    // Plan limit checks
    const { canAddMonitor, limits: planLimits } = usePlanLimits();
    const params = useParams();
    // Params: domainId, tab, integrationId
    const domainUlidParam = params.domainId ?? null;
    const tabParam = params.tab as 'details' | 'regional' | 'integrations' | undefined;
    const integrationIdParam = params.integrationId ? Number(params.integrationId) : null;

    // React Query hooks
    const {
        data: domains = [],
        isLoading: loading,
    } = useDomains();

    const createDomainMutation = useCreateDomain();
    const updateDomainMutation = useUpdateDomain();
    const deleteDomainMutation = useDeleteDomain();

    // State for modals
    const [editingDomain, setEditingDomain] = useState<Domain | null>(null);
    const [domainModalOpen, setDomainModalOpen] = useState(false);
    const [form, setFormState] = useState<DomainFormState>(() => defaultFormState());
    const [deleteTarget, setDeleteTarget] = useState<Domain | null>(null);
    const [monitorLimitModalOpen, setMonitorLimitModalOpen] = useState(false);

    // Derived: selected domain and tab from route
    const selectedDomain = domainUlidParam ? domains.find(d => d.ulid === domainUlidParam) || null : null;
    const selectedTab = tabParam || 'details';

    // When domains load, if domainId is not in URL, select first domain
    useEffect(() => {
        if (!domainUlidParam && domains.length > 0) {
            navigate(`/overview/${domains[0].ulid}/details`, { replace: true });
        }
    }, [domainUlidParam, domains, navigate]);

    // Tab change handler
    const handleTabChange = (tab: 'details' | 'regional' | 'integrations') => {
        if (!selectedDomain) return;
        navigate(`/overview/${selectedDomain.ulid}/${tab}`);
    };

    // Domain change handler
    const handleDomainSelect = (domain: Domain) => {
        navigate(`/overview/${domain.ulid}/${selectedTab}`);
    };

    // Integration panel navigation
    const handleIntegrationPanelOpen = (integrationId: number) => {
        if (!selectedDomain) return;
        navigate(`/overview/${selectedDomain.ulid}/integrations/${integrationId}`);
    };
    const handleIntegrationPanelClose = () => {
        if (!selectedDomain) return;
        navigate(`/overview/${selectedDomain.ulid}/integrations`);
    };

    // Modal open/close logic (unchanged)
    const openCreateModal = useCallback(() => {
        if (!canManage) return;
        // Check plan monitor limit
        const atLimit =
            typeof canAddMonitor === "function"
                ? !canAddMonitor(domains.length)
                : !canAddMonitor;
        if (atLimit) {
            setMonitorLimitModalOpen(true);
            return;
        }
        setEditingDomain(null);
        setFormState(defaultFormState());
        setDomainModalOpen(true);
    }, [canManage, canAddMonitor, domains.length, planLimits.max_monitors]);

    const closeDomainModal = () => {
        if (createDomainMutation.isPending || updateDomainMutation.isPending) return;
        setDomainModalOpen(false);
        setEditingDomain(null);
        setFormState(defaultFormState());
    };

    const handleEditDomain = (domain: Domain) => {
        if (!canManage) return;

        setEditingDomain(domain);
        setFormState({
            name: domain.name,
            url: domain.url,
            label: domain.label ?? "",
            environment: domain.environment ?? "production",
            is_active: domain.is_active,
        });
        setDomainModalOpen(true);
    };

    const handleDeleteRequest = (domain: Domain) => {
        if (!canManage) return;
        setDeleteTarget(domain);
    };

    const closeDeleteModal = () => {
        if (deleteDomainMutation.isPending) return;
        setDeleteTarget(null);
    };

    // Header "Add Domain" event
    useEffect(() => {
        if (!canManage) {
            return;
        }

        const handler = () => openCreateModal();
        window.addEventListener("dm-open-add-domain", handler as EventListener);
        return () => {
            window.removeEventListener("dm-open-add-domain", handler as EventListener);
        };
    }, [canManage, openCreateModal]);

    const handleDomainSubmit = async (e: FormEvent) => {
        e.preventDefault();

        if (!canManage) return;

        const payload: DomainPayload = {
            name: form.name.trim(),
            url: form.url.trim(),
            label: form.label.trim() || null,
            environment: form.environment.trim() || "production",
            is_active: form.is_active,
        };

        try {
            if (editingDomain) {
                await updateDomainMutation.mutateAsync({
                    id: editingDomain.ulid,
                    payload
                });
            } else {
                await createDomainMutation.mutateAsync(payload);
            }

            setDomainModalOpen(false);
            setEditingDomain(null);
            setFormState(defaultFormState());
        } catch {
            // Error handling is done in the mutation hooks
        }
    };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget || !canManage) return;

        try {
            await deleteDomainMutation.mutateAsync(deleteTarget.ulid ?? '');
            setDeleteTarget(null);
        } catch {
            // Error handling is done in the mutation hook
        }
    };

    const saving = createDomainMutation.isPending || updateDomainMutation.isPending;;
    return (
        <div className="w-full max-w-full min-w-0 px-2 pb-10 pt-2 sm:px-4 sm:pt-4 md:px-6 md:pt-6 overflow-x-hidden">
            <section className="mb-4 flex flex-col gap-2 sm:gap-3 md:mb-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                    <h1 className="text-lg sm:text-2xl font-semibold tracking-tight flex items-center gap-2 sm:gap-3">
                        <div className="rounded-lg sm:rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 p-2 sm:p-2.5 shadow-lg shadow-blue-500/20 flex-shrink-0">
                            <Globe size={20} className="sm:w-[22px] sm:h-[22px]" />
                        </div>
                        <span className="truncate">Domains</span>
                    </h1>
                    {!canManage && (
                        <p className="mt-1 text-xs sm:text-sm text-slate-400">
                            You have read-only access. Contact an admin to manage domains.
                        </p>
                    )}
                </div>
            </section>
            <DomainsTable
                domains={domains}
                loading={loading}
                onAddDomain={openCreateModal}
                onEditDomain={handleEditDomain}
                onDeleteDomain={handleDeleteRequest}
                canManage={canManage}
                selectedDomainId={domainUlidParam}
                onDomainSelect={handleDomainSelect}
                activeTab={selectedTab}
                onTabChange={handleTabChange}
                onIntegrationPanelOpen={handleIntegrationPanelOpen}
                integrationPanelIntegrationId={integrationIdParam}
                onIntegrationPanelClose={handleIntegrationPanelClose}
            />

            <Suspense fallback={null}>
                {canManage && domainModalOpen && (
                    <AddDomainModal
                        open={domainModalOpen}
                        saving={saving}
                        form={form}
                        setForm={(updater) => setFormState((prev) => updater(prev))}
                        onClose={closeDomainModal}
                        onSubmit={handleDomainSubmit}
                        isEditing={Boolean(editingDomain)}
                        title={editingDomain ? `Edit Domain` : undefined}
                        submitLabel={editingDomain ? "Save Changes" : undefined}
                    />
                )}

                {canManage && Boolean(deleteTarget) && (
                    <DeleteDomainModal
                        open={Boolean(deleteTarget)}
                        domain={deleteTarget}
                        deleting={deleteDomainMutation.isPending}
                        onCancel={closeDeleteModal}
                        onConfirm={handleDeleteConfirm}
                    />
                )}

                {monitorLimitModalOpen && (
                    <PlanUpgradeModal
                        open={monitorLimitModalOpen}
                        onClose={() => setMonitorLimitModalOpen(false)}
                        onUpgrade={() => {
                            setMonitorLimitModalOpen(false);
                            navigate("/billing");
                        }}
                        title="Monitor Limit Reached"
                        featureLabel="domain monitoring"
                        limitMessage={`Your plan allows up to ${planLimits.max_monitors ?? 0} monitor${
                            (planLimits.max_monitors ?? 0) === 1 ? "" : "s"
                        }. Upgrade to add more.`}
                        upgradeLabel="Upgrade to Add More"
                    />
                )}
            </Suspense>
        </div>
    );
}
