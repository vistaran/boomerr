import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Zap, Shield, Globe, ChevronRight, Loader2, Sparkles, Coins, ChevronLeft } from "lucide-react";
import { OnboardingProgress } from "./OnboardingProgress";
import { motion } from "framer-motion";
import { cancelSubscription, getPlans, subscribeToPlan } from "../../services/billing-service";
import toast from "react-hot-toast";
import type { RazorpayOptions } from "../../types/razorpay";
import { loadRazorpay } from "../../lib/razorpay-loader";
import { detectPreferredCurrency, formatMoney, normalizeCurrency } from "../../lib/currency";

type Interval = "monthly" | "yearly";

export function OnboardingPricingPage() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<any[]>([]);
  const [currentPlanCode, setCurrentPlanCode] = useState<string | null>(null);
  const [currentPlanPriceId, setCurrentPlanPriceId] = useState<number | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState<string>(detectPreferredCurrency);
  const [resolvedCurrency, setResolvedCurrency] = useState<string>(detectPreferredCurrency);
  const [supportedCurrencies, setSupportedCurrencies] = useState<string[]>(["USD", "INR"]);
  const [interval, setInterval] = useState<Interval>("monthly");
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [loadingPlans, setLoadingPlans] = useState(true);

  const planOrder = ["free", "starter", "solopreneur", "teams", "enterprise"];

  const fetchPlans = async () => {
    try {
      setLoadingPlans(true);
      const data = await getPlans(selectedCurrency);
      setPlans(data.plans ?? []);
      setSelectedCurrency(normalizeCurrency(data.requested_currency ?? selectedCurrency));
      setResolvedCurrency(normalizeCurrency(data.resolved_currency ?? selectedCurrency));
      setSupportedCurrencies(
        (data.supported_currencies ?? ["USD", "INR"]).map((currency) => normalizeCurrency(currency))
      );
      setCurrentPlanCode(data.current_plan_code);
      setCurrentPlanPriceId(data.current_plan_price_id);
    } catch {
      // If billing fails silently, just allow skipping
    } finally {
      setLoadingPlans(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, [selectedCurrency]);

  const handleSkip = () => {
    navigate("/onboarding/setup-complete");
  };

  const subscribe = async (planCode: string) => {
    try {
      setLoadingPlan(planCode);
      const data = await subscribeToPlan(planCode, interval, selectedCurrency);

      if (data.public_key && data.subscription_id) {
        try {
          await loadRazorpay();
        } catch {
          toast.error("Payment gateway unavailable. Please try again later.");
          return;
        }

        const rollbackPendingCheckout = async () => {
          try {
            await cancelSubscription(data.subscription_id ?? undefined);
          } catch (cancelError) {
            console.error("Failed to cancel pending subscription after checkout dismissal", cancelError);
          }
          await fetchPlans();
        };

        const options: RazorpayOptions = {
          key: data.public_key,
          subscription_id: data.subscription_id,
          name: "Boomerr",
          description: "14-Day Free Trial, then billed as selected",
          method: {
            upi: false,
            netbanking: false,
            wallet: false,
            emi: false,
            paylater: false
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
          handler: () => {
            toast.success("Subscription started! Enjoy your 14-day trial 🎉");
            navigate("/onboarding/setup-complete");
          },
        };
        const rzp = new window.Razorpay(options);
        rzp.on("payment.failed", async (response: any) => {
          toast.error(response.error?.description || "Payment failed. Please try again.");
          await rollbackPendingCheckout();
        });
        rzp.open();
      } else {
        toast.success(data.message || "Plan updated successfully!");
        navigate("/onboarding/setup-complete");
      }
    } catch (error: any) {
      toast.error(error?.message || "Something went wrong. Please try again.");
    } finally {
      setLoadingPlan(null);
    }
  };

  const shownPlans = plans.filter((p) => p.code !== "enterprise").slice(0, 3);

  const planIcons: Record<string, any> = {
    free: Globe,
    starter: Shield,
    solopreneur: Zap,
    teams: Zap,
  };

  // Per-plan accent configs: [iconColor, badgeBg, badgeText, glowColor, ringColor, btnClass, checkColor]
  const planAccent: Record<string, {
    iconColor: string;
    glow: string;
    ring: string;
    btnClass: string;
    checkColor: string;
    badge?: string;
    cardBg: string;
    borderColor: string;
  }> = {
    free: {
      iconColor: "text-slate-400",
      glow: "",
      ring: "border-slate-700/60",
      btnClass: "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600",
      checkColor: "text-slate-400",
      cardBg: "bg-slate-900/50",
      borderColor: "border-slate-700/60",
    },
    starter: {
      iconColor: "text-blue-400",
      glow: "shadow-[0_0_40px_rgba(59,130,246,0.12)]",
      ring: "border-blue-500/40",
      btnClass: "bg-blue-600 hover:bg-blue-500 text-white hover:shadow-[0_0_20px_rgba(59,130,246,0.45)]",
      checkColor: "text-blue-400",
      badge: "Most Popular",
      cardBg: "bg-gradient-to-b from-blue-950/60 to-slate-900/80",
      borderColor: "border-blue-500/40",
    },
    solopreneur: {
      iconColor: "text-indigo-400",
      glow: "shadow-[0_0_40px_rgba(99,102,241,0.13)]",
      ring: "border-indigo-500/50",
      btnClass: "bg-indigo-600 hover:bg-indigo-500 text-white hover:shadow-[0_0_20px_rgba(99,102,241,0.45)]",
      checkColor: "text-indigo-400",
      badge: "Best Value",
      cardBg: "bg-gradient-to-b from-indigo-950/60 to-slate-900/80",
      borderColor: "border-indigo-500/50",
    },
    teams: {
      iconColor: "text-violet-400",
      glow: "shadow-[0_0_40px_rgba(139,92,246,0.12)]",
      ring: "border-violet-500/50",
      btnClass: "bg-violet-600 hover:bg-violet-500 text-white hover:shadow-[0_0_20px_rgba(139,92,246,0.45)]",
      checkColor: "text-violet-400",
      cardBg: "bg-gradient-to-b from-violet-950/60 to-slate-900/80",
      borderColor: "border-violet-500/50",
    },
  };

  // const planHighlight: Record<string, boolean> = {
  //   starter: true,
  //   solopreneur: true,
  // };

  return (
    <div className="w-full flex flex-col items-center">
      <OnboardingProgress currentStep={6} />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.5 }}
        className="max-w-4xl w-full relative"
      >
        {/* Back Button */}
        <button
          onClick={() => navigate("/onboarding/add-domain")}
          className="absolute -top-10 left-0 flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back
        </button>
        {/* ── Header ── */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-4 py-1.5 mb-4"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-xs font-semibold text-indigo-300 tracking-wide uppercase">Pick your plan</span>
          </motion.div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-3 leading-tight flex items-center justify-center gap-4">
            Simple, transparent pricing
            <div className="relative flex-shrink-0 p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl shadow-[0_0_15px_rgba(99,102,241,0.1)]">
              <Coins className="w-7 h-7 text-indigo-400" strokeWidth={1.5} />
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-slate-900">
                <Check className="w-2.5 h-2.5 text-white" strokeWidth={4} />
              </div>
            </div>
          </h1>
          <p className="text-slate-400 text-base max-w-md mx-auto leading-relaxed">
            Start free. Upgrade whenever you're ready to unlock more monitoring power.
          </p>

          {/* ── Billing Toggle ── */}
          <div className="mt-5 flex flex-col items-center gap-3">
            <div className="inline-flex items-center gap-1 rounded-2xl border border-slate-800 bg-slate-900/80 p-1 backdrop-blur">
              {supportedCurrencies.map((currency) => (
                <button
                  key={currency}
                  type="button"
                  onClick={() => setSelectedCurrency(currency)}
                  className={`rounded-xl px-4 py-2 text-xs font-semibold transition ${selectedCurrency === currency
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/40"
                      : "text-slate-400 hover:text-white"
                    }`}
                >
                  {currency}
                </button>
              ))}
            </div>
            {resolvedCurrency !== selectedCurrency && (
              <p className="text-xs text-amber-300">
                {selectedCurrency} pricing is not fully configured yet, so Boomerr is showing {resolvedCurrency} prices for now.
              </p>
            )}
          </div>

          <div className="mt-6 inline-flex items-center bg-slate-900/80 border border-slate-800 rounded-2xl p-1 gap-1 backdrop-blur">
            {(["monthly", "yearly"] as Interval[]).map((type) => (
              <button
                key={type}
                onClick={() => setInterval(type)}
                className={`relative px-5 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${interval === type
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/40"
                  : "text-slate-400 hover:text-white"
                  }`}
              >
                {type === "monthly" ? "Monthly" : "Yearly"}
                {type === "yearly" && (
                  <span className="ml-2 text-[10px] font-bold bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full border border-emerald-500/20">
                    −20%
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Plan Cards ── */}
        {loadingPlans ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
            <p className="text-slate-500 text-sm">Loading plans…</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
            {shownPlans.map((plan, idx) => {
              const price = plan.prices?.find((p: any) => p.interval === interval);
              const isCurrent = price?.id === currentPlanPriceId;
              const Icon = planIcons[plan.code] ?? Globe;
              const accent = planAccent[plan.code] ?? planAccent.free;
              // const highlighted = planHighlight[plan.code];
              const currentIndex = planOrder.indexOf(currentPlanCode ?? "free");
              const planIndex = planOrder.indexOf(plan.code);
              let buttonText = "Get Started";
              if (isCurrent) buttonText = "Current Plan";
              else if (planIndex > currentIndex) buttonText = "Start Free Trial";
              else if (planIndex < currentIndex) buttonText = "Downgrade";

              const features = (() => {
                const d = plan.details;
                if (!d) return [];
                const list: string[] = [];
                if (d.limits?.max_monitors === 1) list.push("1 domain");
                else if (d.limits?.max_monitors > 1) list.push(`Up to ${d.limits.max_monitors} domains`);
                else if (d.limits?.max_monitors === null) list.push("Unlimited domains");
                if (d.limits?.monitor_interval_minutes) list.push(`${d.limits.monitor_interval_minutes}-min check interval`);
                if (d.limits?.max_status_pages === 1) list.push("1 Status Page");
                else if (d.limits?.max_status_pages && d.limits?.max_status_pages > 1) list.push(`${d.limits.max_status_pages} Status Pages`);
                if (d.limits?.sms_credits_per_month) list.push(`${d.limits.sms_credits_per_month} SMS credits/mo (1=1 SMS)`);
                if (d.features?.ssl_monitoring) list.push("SSL Monitoring");
                if (d.features?.ai_analysis) list.push("AI Analysis");
                if (d.integrations?.slack && !d.limits?.sms_credits_per_month) list.push("Slack Alerts");
                if (d.integrations?.facebook_ads) list.push("Facebook Ads Protection");
                return list.slice(0, 5);
              })();

              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 + idx * 0.1, duration: 0.45 }}
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  className={`relative flex flex-col rounded-2xl border backdrop-blur-xl p-6 ${accent.cardBg} ${accent.borderColor} ${accent.glow} transition-all duration-300`}
                >
                  {/* Badge */}
                  {accent.badge && (
                    <div className="absolute -top-3.5 left-0 right-0 flex justify-center">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-lg ${plan.code === "starter"
                        ? "bg-blue-600 text-white shadow-blue-900/50"
                        : "bg-indigo-600 text-white shadow-indigo-900/50"
                        }`}>
                        {accent.badge}
                      </span>
                    </div>
                  )}

                  {/* Plan header */}
                  <div className="flex items-center gap-3 mb-5 mt-1">
                    <div className={`p-2.5 rounded-xl bg-white/5 border border-white/10 ${accent.iconColor}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <h3 className="text-base font-bold text-white capitalize tracking-tight">{plan.name}</h3>
                  </div>

                  {/* Price */}
                  <div className="mb-5 pb-5 border-b border-white/[0.07]">
                    {price ? (
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-extrabold text-white tracking-tight">
                          {formatMoney(price.price, price.currency)}
                        </span>
                        <span className="text-slate-500 text-sm ml-0.5">
                          /{interval === "monthly" ? "mo" : "yr"}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-400 text-sm">Contact us</span>
                    )}
                    {price?.price === 0 && (
                      <p className="text-xs text-slate-500 mt-1 font-medium">Forever free · No card needed</p>
                    )}
                    {(price?.price ?? 0) > 0 && (
                      <p className="text-xs text-emerald-400 mt-1 font-semibold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                        14-day free trial included
                      </p>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="space-y-2.5 mb-6 flex-grow">
                    {features.map((f) => (
                      <li key={f} className="flex items-center gap-2.5 text-sm text-slate-300">
                        <span className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center bg-white/5 ${accent.checkColor}`}>
                          <Check className="w-2.5 h-2.5" strokeWidth={3} />
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>

                  {/* CTA Button */}
                  <button
                    disabled={isCurrent || loadingPlan === plan.code}
                    onClick={() => subscribe(plan.code)}
                    className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${isCurrent
                      ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                      : accent.btnClass
                      }`}
                  >
                    {loadingPlan === plan.code ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        {buttonText}
                        {!isCurrent && <ChevronRight className="w-4 h-4" />}
                      </>
                    )}
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* ── Skip ── */}
        <div className="text-center pb-2">
          <button
            onClick={handleSkip}
            className="text-slate-600 hover:text-slate-400 text-sm transition-colors duration-200"
          >
            Skip for now, I'll choose a plan later →
          </button>
        </div>
      </motion.div>
    </div>
  );
}
