import { useCallback, useEffect, useRef, useState, lazy, Suspense } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
    getPlans,
    subscribeToPlanWithMode,
    cancelSubscription,
    getTransactionHistory,
    retryPayment,
} from "../services/billing-service";
import type { RazorpayOptions } from "../types/razorpay";
import { loadRazorpay } from "../lib/razorpay-loader";
import { BillingHeader } from "../components/billing/billing-header";
import { PlansTab } from "../components/billing/plans-tab";
import type { Interval, Plan, SwitchMode, Tab, Transaction } from "../components/billing/types";

const TrialActivationModal = lazy(() => import("../components/common/trial-activation-modal").then(m => ({ default: m.TrialActivationModal })));
const PlanDetailsModal = lazy(() => import("../components/billing/plan-details-modal").then(m => ({ default: m.PlanDetailsModal })));
const PlanChangeConfirmationModal = lazy(() => import("../components/billing/plan-change-confirmation-modal").then(m => ({ default: m.PlanChangeConfirmationModal })));
const TransactionsTab = lazy(() => import("../components/billing/transactions-tab").then(m => ({ default: m.TransactionsTab })));
import toast from "react-hot-toast";
import { queryClient } from "../query/query-client";
import { queryKeys } from "../api/query-keys";
import { useAuth } from "../context/auth-context";
import { detectPreferredCurrency, normalizeCurrency } from "../lib/currency";
import { SubscriptionTab } from "../components/billing/subscription-tab";
import { useDomains, domainListQueryKey } from "../hooks/use-domains";
import { ShieldCheck } from "lucide-react";
import { useRuntimeConfig } from "../hooks/use-runtime-config";

export default function BillingPage() {
    const { billingEnabled } = useRuntimeConfig();

    if (!billingEnabled) {
        return (
            <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-8 text-center backdrop-blur-xl relative overflow-hidden shadow-2xl">
                    <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-6">
                        <ShieldCheck size={36} />
                    </div>
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-4">
                        Community Edition
                    </span>
                    <h1 className="text-3xl font-extrabold text-white tracking-tight sm:text-4xl">
                        Unlimited Self-Hosted Mode
                    </h1>
                    <p className="mt-4 text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
                        Commercial billing and subscription limits are disabled on this instance. You have full access to unlimited monitors, unlimited team members, all notification channels, and custom 1-minute check intervals.
                    </p>
                    <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto text-left">
                        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                            <div className="text-emerald-400 font-bold text-lg">Unlimited</div>
                            <div className="text-xs text-slate-400 mt-1">Monitors & Status Pages</div>
                        </div>
                        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                            <div className="text-emerald-400 font-bold text-lg">1 Minute</div>
                            <div className="text-xs text-slate-400 mt-1">Minimum Check Interval</div>
                        </div>
                        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                            <div className="text-emerald-400 font-bold text-lg">Included</div>
                            <div className="text-xs text-slate-400 mt-1">All Integrations & Tools</div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
    const { workspaces, user } = useAuth();
    const { search } = useLocation();
    const location = useLocation();
    const navigate = useNavigate();

    // Read incoming URL params early so initial state honors them (avoids flicker)
    const initParams = new URLSearchParams(search || window.location.search);
    const urlBilling = initParams.get("billing");

    const initialInterval: Interval = urlBilling === "yearly" ? "yearly" : "monthly";
    const initialSelectedCurrency = detectPreferredCurrency();

    const [activeTab, setActiveTab] = useState<Tab>("subscription");
    const [interval, setInterval] = useState<Interval>(initialInterval);
    const [plansLoading, setPlansLoading] = useState(true);
    const [plans, setPlans] = useState<Plan[]>([]);
    const [selectedCurrency, setSelectedCurrency] = useState<string>(initialSelectedCurrency);
    const [resolvedCurrency, setResolvedCurrency] = useState<string>(initialSelectedCurrency);
    const [supportedCurrencies, setSupportedCurrencies] = useState<string[]>(["USD", "INR"]);
    const [currentPlanCode, setCurrentPlanCode] = useState<string | null>(null);
    const [currentPlanPriceId, setCurrentPlanPriceId] = useState<number | null>(null);
    const [currentSubscriptionCurrency, setCurrentSubscriptionCurrency] = useState<string | null>(null);
    const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
    const [gatewayStatus, setGatewayStatus] = useState<string | null>(null);
    const [paymentUpdateUrl, setPaymentUpdateUrl] = useState<string | null>(null);
    const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
    const [gatewaySubscriptionDetails, setGatewaySubscriptionDetails] = useState<Record<string, any> | null>(null);
    const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
    const [cancelling, setCancelling] = useState(false);
    const [retrying, setRetrying] = useState(false);
    const [checkingPaymentStatus, setCheckingPaymentStatus] = useState(false);
    const [hasTriedPaidPlan, setHasTriedPaidPlan] = useState(true); // Default to true to avoid showing badge initially

    // Trial activation modal state
    const [showTrialModal, setShowTrialModal] = useState(false);
    const [trialModalData, setTrialModalData] = useState<{
        planName: string;
        trialEndDate: string;
    } | null>(null);

    // Plan details modal state
    const [showPlanDetailsModal, setShowPlanDetailsModal] = useState(false);
    const [selectedPlanForDetails, setSelectedPlanForDetails] = useState<Plan | null>(null);

    // Plan change confirmation modal state
    const [showConfirmationModal, setShowConfirmationModal] = useState(false);
    const [showDowngradeDomainModal, setShowDowngradeDomainModal] = useState(false);
    const [pendingPlanCode, setPendingPlanCode] = useState<string | null>(null);
    const [confirmationLoading, setConfirmationLoading] = useState(false);
    const [pendingSwitchMode, setPendingSwitchMode] = useState<SwitchMode>("cycle_end");

    // Domains state for plan limit enforcement
    const { data: domains = [] } = useDomains();

    // Transaction history state
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [txPage, setTxPage] = useState(1);
    const [txLastPage, setTxLastPage] = useState(1);
    const [txLoading, setTxLoading] = useState(false);

    const planOrder = ["free", "starter", "solopreneur", "teams", "enterprise"];
    const currentWorkspace =
        workspaces.find((workspace) => workspace.is_current || (workspace as any).pivot?.is_current) ??
        workspaces[0] ??
        null;
    const currentWorkspaceId =
        currentWorkspace?.id ??
        (currentWorkspace as any)?.pivot?.workspace_id ??
        user?.workspace_id ??
        null;
    const canManagePlans =
        currentWorkspace?.role === "owner" ||
        (currentWorkspace as any)?.pivot?.role === "owner" ||
        user?.role === "owner";

    const getEffectiveSubscriptionStatus = useCallback((
        localStatus: string | null,
        remoteGatewayStatus: string | null
    ): string | null => {
        const normalizedLocal = localStatus?.toLowerCase() ?? null;
        const normalizedGateway = remoteGatewayStatus?.toLowerCase() ?? null;

        if (!normalizedGateway) {
            return normalizedLocal;
        }

        if (normalizedGateway === "active" || normalizedGateway === "authenticated") {
            if (["pending", "past_due", "halted", "created"].includes(normalizedLocal ?? "")) {
                return normalizedGateway === "authenticated" ? "trialing" : "active";
            }

            return normalizedLocal ?? (normalizedGateway === "authenticated" ? "trialing" : "active");
        }

        if (normalizedGateway === "halted") {
            return "halted";
        }

        if (["cancelled", "expired", "completed"].includes(normalizedGateway)) {
            return normalizedGateway === "completed" ? "expired" : normalizedGateway;
        }

        return normalizedLocal;
    }, []);

    const shouldContinueBillingPolling = useCallback((
        status: string | null,
        planCode: string | null,
        expectedPlanCode?: string
    ): boolean => {
        if (expectedPlanCode && expectedPlanCode !== "free" && planCode !== expectedPlanCode) {
            return true;
        }

        if (!status || !planCode || planCode === "free") {
            return false;
        }

        return ["pending", "past_due", "halted", "created", "authenticated"].includes(status);
    }, []);

    const fetchPlans = useCallback(async () => {
        try {
            const data = await getPlans(selectedCurrency);
            const fallbackCurrentPlanCode = data.current_plan_code ?? "free";
            const fallbackCurrentPlanPriceId = data.current_plan_price_id ?? (
                data.plans
                    .find((plan: any) => plan.code === "free")
                    ?.prices?.find((price: any) => price.interval === "monthly")?.id
                ?? data.plans.find((plan: any) => plan.code === "free")?.prices?.[0]?.id
                ?? null
            );
            const effectiveStatus = getEffectiveSubscriptionStatus(
                data.status ?? null,
                data.gateway_status ?? null
            );
            const fallbackEffectiveStatus = effectiveStatus ?? (fallbackCurrentPlanCode === "free" ? "active" : null);

            setPlans(data.plans);
            setResolvedCurrency(normalizeCurrency(data.resolved_currency ?? selectedCurrency));
            setSupportedCurrencies(
                (data.supported_currencies ?? ["USD", "INR"]).map((currency) => normalizeCurrency(currency))
            );
            setCurrentPlanCode(fallbackCurrentPlanCode);
            setCurrentPlanPriceId(fallbackCurrentPlanPriceId);
            setCurrentSubscriptionCurrency(data.current_subscription_currency ?? null);
            setSubscriptionStatus(fallbackEffectiveStatus);
            setGatewayStatus(data.gateway_status ?? null);
            setGatewaySubscriptionDetails(data.gateway_subscription_details ?? null);
            setPaymentUpdateUrl(data.payment_update_url ?? null);
            setTrialEndsAt(data.trial_ends_at ?? null);
            setHasTriedPaidPlan(data.has_tried_paid_plan ?? false);
            queryClient.invalidateQueries({ queryKey: queryKeys.billing.planInfo() });

            return {
                effectiveStatus: fallbackEffectiveStatus,
                currentPlanCode: fallbackCurrentPlanCode,
            };
        } catch (error: any) {
            console.error(error);
            return null;
        } finally {
            setPlansLoading(false);
        }
    }, [getEffectiveSubscriptionStatus, selectedCurrency]);

    const refreshPlansWithPolling = useCallback(async (expectedPlanCode?: string) => {
        const firstFetch = await fetchPlans();

        if (!firstFetch || !shouldContinueBillingPolling(firstFetch.effectiveStatus, firstFetch.currentPlanCode, expectedPlanCode)) {
            return;
        }

        // Wait a bit longer before polling to allow backend processing
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const maxPolls = 12; // Increased from 8 to 12 (18 seconds total)
        for (let index = 0; index < maxPolls; index++) {
            await new Promise((resolve) => setTimeout(resolve, 1500));
            const polled = await fetchPlans();

            if (!polled || !shouldContinueBillingPolling(polled.effectiveStatus, polled.currentPlanCode, expectedPlanCode)) {
                break;
            }
        }
    }, [fetchPlans, shouldContinueBillingPolling]);

    const initialRouteDone = useRef<number | null>(null);

    useEffect(() => {
        if (!canManagePlans) {
            setPlans([]);
            setCurrentPlanCode(null);
            setCurrentPlanPriceId(null);
            setCurrentSubscriptionCurrency(null);
            setSubscriptionStatus(null);
            setGatewayStatus(null);
            setPaymentUpdateUrl(null);
            setTrialEndsAt(null);
            setPlansLoading(false);
            return;
        }

        setPlansLoading(true);
        fetchPlans().then((res) => {
            if (initialRouteDone.current !== currentWorkspaceId) {
                if (res && (res.currentPlanCode === "free" || ["cancelled", "expired"].includes(res.effectiveStatus || ""))) {
                    setActiveTab("plans");
                }
                initialRouteDone.current = currentWorkspaceId;
            }
        });
    }, [canManagePlans, currentWorkspaceId, fetchPlans]);

    // If the user landed on /billing?plan=..., open the plan details modal after plans are loaded
    const [openedPlanFromQuery, setOpenedPlanFromQuery] = useState(false);
    useEffect(() => {
        try {
            const params = new URLSearchParams(location.search || window.location.search);
            const planParam = params.get('plan');
            const billingParam = params.get('billing');

            if (billingParam) {
                setInterval(billingParam === 'yearly' ? 'yearly' : 'monthly');
            }

            if (planParam && plans.length && !openedPlanFromQuery && currentPlanCode !== null) {
                const target = plans.find((p) => p.code === planParam || p.code === planParam.toLowerCase());
                if (target) {
                    if (target.code === currentPlanCode) {
                        toast.success(`You are already on the ${target.name} plan.`);
                    } else {
                        // Instead of showing feature/details modal, open the plan change confirmation modal
                        setPendingPlanCode(target.code);
                        setShowConfirmationModal(true);
                    }
                    setOpenedPlanFromQuery(true);
                    // remove the plan/currency/billing/auth params from URL
                    params.delete('plan');
                    params.delete('currency');
                    params.delete('billing');
                    params.delete('auth');
                    const search = params.toString();
                    navigate({ pathname: location.pathname, search: search ? `?${search}` : '' }, { replace: true });
                }
            }
        } catch (e) {
            // ignore
            console.log(e);

        }
    }, [plans, location.search, openedPlanFromQuery, navigate, currentPlanCode]);

    useEffect(() => {
        if (!canManagePlans || activeTab !== "plans" || !currentWorkspaceId) {
            return;
        }

        type BillingRealtimePayload = {
            workspace_id?: number;
        };

        const handleBillingStatusUpdated = async (event: Event) => {
            const customEvent = event as CustomEvent<BillingRealtimePayload>;
            const incomingWorkspaceId = customEvent.detail?.workspace_id ?? null;

            if (incomingWorkspaceId !== currentWorkspaceId) {
                return;
            }

            await fetchPlans();
        };

        window.addEventListener("billing:status-updated", handleBillingStatusUpdated as EventListener);

        return () => {
            window.removeEventListener("billing:status-updated", handleBillingStatusUpdated as EventListener);
        };
    }, [activeTab, canManagePlans, currentWorkspaceId, fetchPlans]);

    useEffect(() => {
        setTxPage(1);
        setTransactions([]);
    }, [currentWorkspaceId]);

    useEffect(() => {
        if (!canManagePlans) {
            return;
        }

        if (activeTab === "transactions") {
            fetchTransactions(txPage);
        }
    }, [activeTab, canManagePlans, currentWorkspaceId, txPage]);

    const fetchTransactions = async (page: number) => {
        setTxLoading(true);
        try {
            const data = await getTransactionHistory(page);
            setTransactions(data.data);
            setTxLastPage(data.last_page);
        } catch {
            toast.error("Failed to load transaction history.");
        } finally {
            setTxLoading(false);
        }
    };

    const subscribe = async (planCode: string) => {
        if (!canManagePlans) {
            toast.error("Only workspace owners can manage billing plans.");
            return;
        }

        const targetPlan = plans.find((p) => p.code === planCode);
        const currentIndex = planOrder.indexOf(currentPlanCode ?? "free");
        const targetIndex = planOrder.indexOf(planCode);
        const isDowngrade = targetIndex < currentIndex;
        const targetLimit = targetPlan?.details?.limits?.max_monitors;
        const activeMonitorsCount = domains.filter((d) => d.is_active && d.paused_reason !== "user").length;

        // If downgrading and active domains exceed target plan monitor limit, show domain selection modal
        if (isDowngrade && targetLimit !== null && targetLimit !== undefined && activeMonitorsCount > targetLimit) {
            setPendingPlanCode(planCode);
            setShowDowngradeDomainModal(true);
            return;
        }

        // Show confirmation modal instead of directly subscribing
        setPendingPlanCode(planCode);
        setShowConfirmationModal(true);
    };

    const handleConfirmDowngradeWithDomains = async (keepDomainIds: number[]) => {
        if (!pendingPlanCode) return;

        try {
            setLoadingPlan(`${pendingPlanCode}-${interval}`);
            setConfirmationLoading(true);

            const data = await subscribeToPlanWithMode(
                pendingPlanCode,
                interval,
                pendingSwitchMode,
                selectedCurrency,
                keepDomainIds
            );

            if (data.public_key && data.subscription_id && typeof window.Razorpay === "function") {
                const options: RazorpayOptions = {
                    key: data.public_key,
                    subscription_id: data.subscription_id,
                    name: "Boomerr",
                    description: "Billed as selected",
                    modal: {
                        backdropclose: true,
                        escape: true,
                        ondismiss: async () => {
                            setShowDowngradeDomainModal(false);
                            setConfirmationLoading(false);
                            setLoadingPlan(null);
                            setPendingPlanCode(null);
                            await refreshPlansWithPolling();
                        },
                    },
                    theme: {
                        color: "#4f46e5",
                        backdrop_color: "#000000",
                    },
                    handler: async function () {
                        toast.success("Subscription updated successfully!");
                        setShowDowngradeDomainModal(false);
                        setConfirmationLoading(false);
                        setLoadingPlan(null);
                        setPendingPlanCode(null);
                        await queryClient.invalidateQueries({ queryKey: domainListQueryKey });
                        await refreshPlansWithPolling();
                    },
                };

                const rzp = new window.Razorpay(options);
                rzp.open();
                return;
            }

            toast.success(data.message || "Downgraded successfully! Selected domains kept active.");
            setShowDowngradeDomainModal(false);
            setConfirmationLoading(false);
            setLoadingPlan(null);
            setPendingPlanCode(null);
            await queryClient.invalidateQueries({ queryKey: domainListQueryKey });
            await refreshPlansWithPolling();
        } catch (error: any) {
            toast.error(error?.message || "Failed to process downgrade. Please try again.");
            setConfirmationLoading(false);
            setLoadingPlan(null);
        }
    };

    const confirmSubscribe = async () => {
        if (!pendingPlanCode) return;

        try {
            setLoadingPlan(`${pendingPlanCode}-${interval}`);
            setConfirmationLoading(true);

            const data = await subscribeToPlanWithMode(
                pendingPlanCode,
                interval,
                pendingSwitchMode,
                selectedCurrency,
            );

            // Handle reused lifecycle subscription via Razorpay modal only.
            const rollbackPendingCheckout = async () => {
                try {
                    await cancelSubscription(data.subscription_id ?? undefined);
                } catch (cancelError) {
                    console.error("Failed to cancel pending subscription after checkout dismissal", cancelError);
                }

                setShowConfirmationModal(false);
                setConfirmationLoading(false);
                setLoadingPlan(null);
                setPendingPlanCode(null);
                setPendingSwitchMode("cycle_end");
                await refreshPlansWithPolling();
            };

            if (data.reuse && data.payment_url) {
                toast.success(data.message || "Payment authentication pending. Redirecting to payment...");

                // If gateway provided a public key and subscription id, open Razorpay modal
                try { await loadRazorpay(); } catch { toast.error("Unable to open payment popup. Please try again."); await rollbackPendingCheckout(); return; }
                if (data.public_key && data.subscription_id) {
                    const options: RazorpayOptions = {
                        key: data.public_key,
                        subscription_id: data.subscription_id,
                        name: "Boomerr",
                        description: data.is_trial_activated
                            ? "14-Day Free Trial, then billed as selected"
                            : "Billed as selected",
                        method: {
                            upi: false,
                            netbanking: false,
                            wallet: false,
                            emi: false,
                            paylater: false,
                        },
                        modal: {
                            backdropclose: true,
                            escape: true,
                            ondismiss: rollbackPendingCheckout,
                        },
                        theme: {
                            color: "#4f46e5",
                            backdrop_color: "#000000",
                        },
                        handler: async function () {
                            if (data.is_trial_activated && data.plan_name && data.trial_ends_at) {
                                setTrialModalData({
                                    planName: data.plan_name,
                                    trialEndDate: data.trial_ends_at,
                                });
                                setShowTrialModal(true);
                            } else {
                                toast.success("Subscription updated successfully!");
                            }

                            import("../lib/analytics").then(({ trackEvent }) => {
                                trackEvent("checkout_completed", { plan_code: pendingPlanCode, interval, currency: selectedCurrency, is_trial: data.is_trial_activated });
                            });

                            setConfirmationLoading(false);
                            setShowConfirmationModal(false);
                            setLoadingPlan(null);
                            setPendingPlanCode(null);
                            setPendingSwitchMode("cycle_end");
                            await refreshPlansWithPolling(pendingPlanCode);
                        },
                    };

                    const rzp = new window.Razorpay(options);

                    rzp.on("payment.failed", async function (response: any) {
                        console.error("Razorpay payment failed", response.error);
                        toast.error(response.error?.description || "Payment failed. Please try again.");
                        await rollbackPendingCheckout();
                    });

                    import("../lib/analytics").then(({ trackEvent }) => {
                        trackEvent("checkout_started", { plan_code: pendingPlanCode, interval, currency: selectedCurrency });
                    });
                    rzp.open();
                } else {
                    toast.error("Unable to open payment popup. Please try again.");
                    await rollbackPendingCheckout();
                }

                return;
            }

            // Only open Razorpay checkout if key and subscription_id are present (paid plan)
            if (data.public_key && data.subscription_id) {
                try {
                    await loadRazorpay();
                } catch {
                    setConfirmationLoading(false);
                    toast.error("Payment gateway is unavailable. Please try again later.");
                    return;
                }

                const options: RazorpayOptions = {
                    key: data.public_key,
                    subscription_id: data.subscription_id,
                    name: "Boomerr",
                    description: data.is_trial_activated
                        ? "14-Day Free Trial, then billed as selected"
                        : "Billed as selected",
                    modal: {
                        backdropclose: true,
                        escape: true,
                        ondismiss: rollbackPendingCheckout,
                    },
                    theme: {
                        color: "#4f46e5",
                        backdrop_color: "#000000",
                    },
                    handler: async function () {
                        if (data.is_trial_activated && data.plan_name && data.trial_ends_at) {
                            setTrialModalData({
                                planName: data.plan_name,
                                trialEndDate: data.trial_ends_at,
                            });
                            setShowTrialModal(true);
                        } else {
                            toast.success("Subscription updated successfully!");
                        }

                        import("../lib/analytics").then(({ trackEvent }) => {
                            trackEvent("checkout_completed", { plan_code: pendingPlanCode, interval, currency: selectedCurrency, is_trial: data.is_trial_activated });
                        });

                        setConfirmationLoading(false);
                        setShowConfirmationModal(false);
                        setLoadingPlan(null);
                        setPendingPlanCode(null);
                        setPendingSwitchMode("cycle_end");
                        await refreshPlansWithPolling(pendingPlanCode);
                    },
                };

                const rzp = new window.Razorpay(options);

                rzp.on("payment.failed", async function (response: any) {
                    console.error("Razorpay payment failed", response.error);
                    toast.error(
                        response.error?.description || "Payment failed. Please try again."
                    );
                    await rollbackPendingCheckout();
                });

                import("../lib/analytics").then(({ trackEvent }) => {
                    trackEvent("checkout_started", { plan_code: pendingPlanCode, interval, currency: selectedCurrency });
                });
                rzp.open();
            } else {
                toast.success(data.message || "Plan updated successfully!");
                setShowConfirmationModal(false);
                setConfirmationLoading(false);
                setLoadingPlan(null);
                await refreshPlansWithPolling();
                import("../lib/analytics").then(({ trackEvent }) => {
                    trackEvent("checkout_completed", { plan_code: pendingPlanCode, interval, currency: selectedCurrency, is_trial: data.is_trial_activated });
                });
            }
        } catch (error: any) {
            toast.error(error?.message || "Something went wrong. Please try again.");
            setConfirmationLoading(false);
            setLoadingPlan(null);
        }
    };

    const handleCancel = async () => {
        if (!canManagePlans) {
            toast.error("Only workspace owners can manage billing plans.");
            return;
        }

        setCancelling(true);
        try {
            const res = await cancelSubscription();
            toast.success(res.message);
            await refreshPlansWithPolling();
        } catch (error: any) {
            toast.error(error?.message || "Failed to cancel subscription.");
        } finally {
            setCancelling(false);
        }
    };

    const handleRetry = async () => {
        if (!canManagePlans) {
            toast.error("Only workspace owners can manage billing plans.");
            return;
        }

        setRetrying(true);
        try {
            const res = await retryPayment();

            if (!res.retry_allowed) {
                toast.error(res.message || "Retry is not allowed for this subscription.");
                return;
            }

            toast.success(res.message);

            const paymentUrl = res.payment_url ?? paymentUpdateUrl;
            if (paymentUrl) {
                window.open(paymentUrl, "_blank", "noopener,noreferrer");
            }

            // Poll for status updates after retry
            setCheckingPaymentStatus(true);

            // Initial delay to allow Razorpay to process
            await new Promise((resolve) => setTimeout(resolve, 1000));

            // Define initial status for polling
            const previousStatus = subscriptionStatus;
            let statusUpdated = false;
            let pollCount = 0;
            const maxPolls = 10; // Max 20 seconds (10 polls × 2 seconds)

            while (pollCount < maxPolls && !statusUpdated) {
                await fetchPlans();
                pollCount++;

                // Check if status has changed
                if (previousStatus !== subscriptionStatus) {
                    statusUpdated = true;
                    break;
                }

                // Wait before next poll (skip if last poll)
                if (pollCount < maxPolls) {
                    await new Promise((resolve) => setTimeout(resolve, 2000));
                }
            }

            setCheckingPaymentStatus(false);
        } catch (error: any) {
            toast.error(error?.message || "Failed to retry payment.");
            setCheckingPaymentStatus(false);
        } finally {
            setRetrying(false);
        }
    };

    const statusBadge = (status: Transaction["status"]) => {
        const map: Record<Transaction["status"], string> = {
            captured: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
            failed: "bg-red-500/10 text-red-400 border-red-500/20",
            refunded: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        };
        return map[status] ?? "";
    };

    const subscriptionStatusBadge = (status: string | null) => {
        if (!status) return { className: "", label: "" };
        const map: Record<string, { className: string; label: string }> = {
            trialing: { className: "bg-amber-500/10 text-amber-400 border-amber-500/20", label: "Trial" },
            active: { className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", label: "Active" },
            past_due: { className: "bg-red-500/10 text-red-400 border-red-500/20", label: "Past Due" },
            pending: { className: "bg-red-500/10 text-red-400 border-red-500/20", label: "Pending" },
            halted: { className: "bg-red-500/10 text-red-400 border-red-500/20", label: "Halted" },
            cancelled: { className: "bg-slate-500/10 text-slate-400 border-slate-500/20", label: "Cancelled" },
            cancel_at_cycle_end: { className: "bg-amber-500/10 text-amber-400 border-amber-500/20", label: "Cancels at Cycle End" },
            expired: { className: "bg-slate-500/10 text-slate-400 border-slate-500/20", label: "Expired" },
        };
        return map[status] ?? { className: "bg-slate-500/10 text-slate-400 border-slate-500/20", label: status };
    };

    const canResubscribeFromCurrentCard =
        subscriptionStatus === "halted" &&
        plans.some((plan) =>
            plan.prices.some(
                (price) => price.id === currentPlanPriceId && price.interval === interval
            )
        );

    const canUpdatePaymentMethod =
        !!paymentUpdateUrl &&
        ["pending", "halted", "past_due"].includes(subscriptionStatus ?? "");

    const isGatewayTerminal = ["expired", "cancelled", "completed", "halted"].includes(
        (gatewayStatus ?? "").toLowerCase()
    );

    const openPlanDetails = (plan: Plan) => {
        setSelectedPlanForDetails(plan);
        setShowPlanDetailsModal(true);
    };

    if (!canManagePlans) {
        return (
            <div className="min-h-screen py-12 px-6 text-slate-200 rounded-lg">
                <div className="max-w-7xl mx-auto">
                    <p className="text-sm font-semibold text-slate-400 mb-1">Manage account</p>
                    <h1 className="text-4xl font-bold mb-8 text-white">Billing</h1>

                    <div className="border border-slate-800 rounded-lg p-14 text-center bg-slate-950/60">
                        <h2 className="text-4xl font-bold text-white mb-4">No Access</h2>
                        <p className="text-slate-300 text-lg">
                            You do not have access to view this page. Only workspace owners can access billing.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen py-12 px-6 text-slate-200 rounded-lg">
            <div className="max-w-7xl mx-auto">
                <BillingHeader
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    isPlansLoading={plansLoading}
                    currentPlanCode={currentPlanCode}
                    subscriptionStatus={subscriptionStatus}
                    trialEndsAt={trialEndsAt}
                    hasTriedPaidPlan={hasTriedPaidPlan}
                    subscriptionStatusBadge={subscriptionStatusBadge}
                />


                {activeTab === "plans" ? (
                    <PlansTab
                        isLoading={plansLoading}
                        canManagePlans={canManagePlans}
                        plans={plans}
                        interval={interval}
                        setInterval={setInterval}
                        currentPlanCode={currentPlanCode}
                        currentPlanPriceId={currentPlanPriceId}
                        subscriptionStatus={subscriptionStatus}
                        gatewayStatus={gatewayStatus}
                        paymentUpdateUrl={paymentUpdateUrl}
                        loadingPlan={loadingPlan}
                        retrying={retrying}
                        cancelling={cancelling}
                        checkingPaymentStatus={checkingPaymentStatus}
                        canResubscribeFromCurrentCard={canResubscribeFromCurrentCard}
                        canUpdatePaymentMethod={canUpdatePaymentMethod}
                        isGatewayTerminal={isGatewayTerminal}
                        planOrder={planOrder}
                        hasTriedPaidPlan={hasTriedPaidPlan}
                        onSubscribe={subscribe}
                        onOpenPlanDetails={openPlanDetails}
                        onRetry={handleRetry}
                        onCancel={handleCancel}
                    />
                ) : activeTab === "subscription" ? (
                    <SubscriptionTab
                        isLoading={plansLoading}
                        currentPlanCode={currentPlanCode}
                        subscriptionStatus={subscriptionStatus}
                        gatewaySubscriptionDetails={gatewaySubscriptionDetails}
                        subscriptionStatusBadge={subscriptionStatusBadge}
                        userEmail={currentWorkspace?.owner_email || workspaces.find(w => w.id === currentWorkspaceId)?.owner_email}
                        plans={plans}
                        interval={interval}
                        onCancel={handleCancel}
                        cancelling={cancelling}
                        canManagePlans={canManagePlans}
                    />
                ) : (
                    <Suspense fallback={<div className="h-64 flex items-center justify-center text-slate-500 text-sm">Loading transactions...</div>}>
                        <TransactionsTab
                            transactions={transactions}
                            txLoading={txLoading}
                            txPage={txPage}
                            txLastPage={txLastPage}
                            setTxPage={setTxPage}
                            statusBadge={statusBadge}
                        />
                    </Suspense>
                )}

            </div>

            <Suspense fallback={null}>
                {/* Trial Activation Modal */}
                {trialModalData && (
                    <TrialActivationModal
                        open={showTrialModal}
                        onClose={() => setShowTrialModal(false)}
                        planName={trialModalData.planName}
                        trialEndDate={trialModalData.trialEndDate}
                    />
                )}

                {showPlanDetailsModal && (
                    <PlanDetailsModal
                        open={showPlanDetailsModal}
                        plan={selectedPlanForDetails}
                        onClose={() => setShowPlanDetailsModal(false)}
                    />
                )}

                {/* Plan Change Confirmation Modal */}
                {pendingPlanCode && showConfirmationModal && (
                    <PlanChangeConfirmationModal
                        open={showConfirmationModal}
                        currentPlan={plans.find((p) => p.code === currentPlanCode) || null}
                        newPlan={plans.find((p) => p.code === pendingPlanCode) || null}
                        interval={interval}
                        currentPlanPrice={
                            plans
                                .find((p) => p.code === currentPlanCode)
                                ?.prices.find((pr) => pr.interval === interval)?.price || null
                        }
                        currentPlanCurrency={
                            plans
                                .find((p) => p.code === currentPlanCode)
                                ?.prices.find((pr) => pr.interval === interval)?.currency || null
                        }
                        newPlanPrice={
                            plans
                                .find((p) => p.code === pendingPlanCode)
                                ?.prices.find((pr) => pr.interval === interval)?.price || null
                        }
                        newPlanCurrency={
                            plans
                                .find((p) => p.code === pendingPlanCode)
                                ?.prices.find((pr) => pr.interval === interval)?.currency || null
                        }
                        isUpgrade={
                            (planOrder.indexOf(pendingPlanCode) ?? -1) >
                            (planOrder.indexOf(currentPlanCode ?? "free") ?? -1)
                        }
                        onConfirm={confirmSubscribe}
                        switchMode={pendingSwitchMode}
                        onSwitchModeChange={setPendingSwitchMode}
                        onCancel={() => {
                            setShowConfirmationModal(false);
                            setPendingPlanCode(null);
                            setPendingSwitchMode("cycle_end");
                        }}
                        isLoading={confirmationLoading}
                        hasTriedPaidPlan={hasTriedPaidPlan}
                    />
                )}
            </Suspense>
        </div>
    );
}
