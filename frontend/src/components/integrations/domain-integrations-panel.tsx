import React, { useState, useEffect } from "react";

import { IntegrationsPanel } from "./integrations-panel";
import { ClickUpEditModal } from "./clickup-edit-modal";
import { EditWebhookModal } from "./edit-webhook-modal";
import { DeleteWebhookModal } from "./delete-webhook-modal";
import toast from "react-hot-toast";
import { addNotificationChannel, deleteNotificationChannel, getAvailableIntegrationWebhooks, updateNotificationChannel } from "../../services/integrations-service";
import type { DomainIntegration } from "../../types/domain-integrations";
import type { IntegrationWebhook } from "../../types/integration-webhooks";
import { DeveloperWebhooksPanel } from "./developer-webhooks/developer-webhooks-panel";

export function DomainIntegrationsPanel({ canManage, selectedProvider, setSelectedProvider, domainId, domainNumericId, domainName, domainStatus }: {
    canManage: boolean,
    selectedProvider: DomainIntegration,
    setSelectedProvider: (p: any) => void,
    domainId: string | null,
    domainNumericId?: number | null,
    domainName?: string,
    domainStatus?: string
}) {
    // Dynamic integrations
    const [webhooks, setWebhooks] = useState<IntegrationWebhook[]>([]);
    const [loadingWebhooks, setLoadingWebhooks] = useState(true);

    const [newWebhook, setNewWebhook] = useState<{name: string, url: string, events: string[]}>({ name: "", url: "", events: ['Domain Up', 'Domain Down', 'SSL Expiring', 'SSL Expired'] });
    const [editingWebhook, setEditingWebhook] = useState<IntegrationWebhook | null>(null);
    const [editFormData, setEditFormData] = useState<{name: string, url: string, events: string[]}>({
        name: "", url: "", events: []
    });
    const [deleteTarget, setDeleteTarget] = useState<IntegrationWebhook | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // DRY: Fetch webhooks helper
    const fetchWebhooks = React.useCallback(async (showLoader = true) => {
        if (showLoader) setLoadingWebhooks(true);
        const providerId = selectedProvider.ulid ?? selectedProvider.id;
        const data = await getAvailableIntegrationWebhooks(domainId, providerId);
        setWebhooks(data);
        if (showLoader) setLoadingWebhooks(false);
    }, [domainId, selectedProvider]);

    useEffect(() => {
        (async () => {
            await fetchWebhooks();
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [domainId, selectedProvider]);

    const ensureCanManage = () => {
        if (!canManage) {
            toast.error("You don't have permission to modify integrations.");
            return false;
        }
        return true;
    };

    const handleAddWebhook = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!ensureCanManage()) return;
        setSubmitting(true);
        try {
            await addNotificationChannel({
                integration_ulid: String(selectedProvider.ulid ?? selectedProvider.id),
                name: newWebhook.name.trim(),
                url: newWebhook.url.trim(),
                events: newWebhook.events,
                domain_id: domainId as string
            });

            await fetchWebhooks(false);
            setNewWebhook({ name: "", url: "", events: ['Domain Up', 'Domain Down', 'SSL Expiring', 'SSL Expired'] });
            setShowAddModal(false);
        } catch (e) {
            console.error("Error adding webhook", e);
            toast.error(e instanceof Error ? e.message : "Failed to add webhook");
        } finally {
            setSubmitting(false);
        }
    };



    const closeEditModal = () => {
        if (submitting) return;
        setEditingWebhook(null);
        setEditFormData({ name: "", url: "", events: [] });
    };

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingWebhook) return;
        if (!ensureCanManage()) return;
        try {
            await updateNotificationChannel(String(editingWebhook.ulid ?? editingWebhook.id), {
                name: editFormData.name.trim(),
                url: editFormData.url.trim(),
                events: editFormData.events,
            });
            await fetchWebhooks(false);
            closeEditModal();
        } catch (err) {
            console.error("Error updating webhook", err);
        }
    };

    const closeDeleteModal = () => {
        setDeleteTarget(null);
    };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        if (!ensureCanManage()) return;

        setSubmitting(true);
        try {
            await deleteNotificationChannel(String(deleteTarget.ulid ?? deleteTarget.id));
            setDeleteTarget(null);
            toast.success("Webhook deleted successfully");
            setSubmitting(false);
            await fetchWebhooks(false);
        } catch (err) {
            setSubmitting(false);
            console.error("Error deleting webhook", err);
        }
    };

    // No integrations list UI here
    if (!selectedProvider) return null;

    // Integration management panel (replaces domain details)
    const integrationKey = selectedProvider.integration.key;

    return (
        <div className="animate-fade-in-up flex flex-col h-full relative min-h-[400px]">
            <IntegrationsPanel
                selectedProvider={selectedProvider}
                webhooks={webhooks}
                setSelectedProvider={setSelectedProvider}
                setEditingWebhook={setEditingWebhook}
                newWebhook={newWebhook}
                setNewWebhook={(updater) => setNewWebhook((prev) => updater(prev))}
                addingWebhook={submitting}
                onAddWebhook={handleAddWebhook}
                loading={loadingWebhooks}
                canManage={canManage}
                showAddModal={showAddModal}
                setShowAddModal={setShowAddModal}
                setEditFormData={setEditFormData}
                setDeleteTarget={setDeleteTarget}
                fetchWebhooks={fetchWebhooks}
                domainId={domainId}
                domainNumericId={domainNumericId}
                domainName={domainName}
                domainStatus={domainStatus}
            />
            {canManage && editingWebhook?.type === "clickup" && (
                <ClickUpEditModal
                    open={Boolean(editingWebhook)}
                    provider={selectedProvider}
                    webhook={editingWebhook}
                    onClose={closeEditModal}
                    onUpdated={() => {
                        closeEditModal();
                        fetchWebhooks();
                    }}
                    canManage={canManage}
                />
            )}
            {canManage && editingWebhook?.type !== "clickup" && (
                <EditWebhookModal
                    open={Boolean(editingWebhook)}
                    provider={selectedProvider}
                    webhook={editingWebhook}
                    saving={submitting}
                    onClose={closeEditModal}
                    onSubmit={handleEditSubmit}
                    formData={editFormData}
                    setFormData={setEditFormData}
                />
            )}
            {canManage && (
                <DeleteWebhookModal
                    open={Boolean(deleteTarget)}
                    provider={selectedProvider}
                    webhook={deleteTarget}
                    deleting={submitting}
                    onCancel={closeDeleteModal}
                    onConfirm={handleDeleteConfirm}
                />
            )}
        </div>
    );
}
