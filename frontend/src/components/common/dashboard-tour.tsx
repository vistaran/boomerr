import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import { X, ChevronRight, ChevronLeft } from "lucide-react";
import { useAuth } from "../../context/auth-context";
import { useDomains } from "../../hooks/use-domains";
import { saveOnboardingData, getOnboardingData } from "../../services/api-service";
import toast from "react-hot-toast";

type Step = {
  id: string;
  targetId: string;
  title: string;
  content: string;
  route?: string;
  position?: "top" | "bottom" | "left" | "right";
  condition?: (hasDomains: boolean) => boolean;
};

const TOUR_STEPS: Step[] = [
  {
    id: "step-dashboard",
    targetId: "tour-dashboard-overview",
    title: "Dashboard Overview",
    content: "Welcome! Here is a high-level view of your entire infrastructure, including total domains, open incidents, and average uptime.",
    route: "/dashboard",
    position: "bottom",
  },
  {
    id: "step-domains",
    targetId: "tour-domains",
    title: "Manage Domains",
    content: "Here you can add, configure, and monitor your domains.",
    route: "/overview",
    position: "right",
  },
  {
    id: "step-domain-tabs",
    targetId: "tour-domain-tabs",
    title: "Domain Details & Monitoring",
    content: "View detailed performance metrics, global edge monitoring status, and configure alert integrations for your domain.",
    route: "conditional-domain", // handled dynamically
    position: "bottom",
    condition: (hasDomains) => hasDomains,
  },
  {
    id: "step-ssl",
    targetId: "tour-ssl-monitoring",
    title: "SSL Monitoring",
    content: "Keep track of all your SSL certificates and get alerts before they expire.",
    position: "right",
  },
  {
    id: "step-incidents",
    targetId: "tour-incidents",
    title: "Incidents",
    content: "View and manage active or historical downtime incidents.",
    position: "right",
  },
  {
    id: "step-status-pages",
    targetId: "tour-status-pages",
    title: "Status Pages",
    content: "Create beautiful, public-facing status pages to keep your users informed.",
    position: "right",
  },
  {
    id: "step-departments",
    targetId: "tour-departments",
    title: "Departments",
    content: "Organize your team members into departments to manage access and alert routing.",
    position: "right",
  },
  {
    id: "step-logs",
    targetId: "tour-logs",
    title: "System Logs",
    content: "Review system activity and audit logs for your workspace.",
    position: "right",
  },
];

export function DashboardTour() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { data: domains = [], isLoading: domainsLoading } = useDomains();

  const [isVisible, setIsVisible] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // Filter steps based on conditions
  const activeSteps = TOUR_STEPS.filter(
    (step) => !step.condition || step.condition(domains.length > 0)
  );

  // Resolve dynamic route for domain tabs
  const currentStep = activeSteps[currentStepIndex];
  let targetRoute = currentStep?.route;
  if (targetRoute === "conditional-domain" && domains.length > 0) {
    targetRoute = `/overview/${domains[0].ulid}/details`;
  }

  // Check if tour should be shown
  useEffect(() => {
    async function checkTourStatus() {
      if (!user) return;
      try {
        const data = await getOnboardingData();
        if (data && !data.dashboard_tour_completed) {
          // If on dashboard, show it, otherwise redirect to dashboard
          if (location.pathname === "/dashboard") {
            setIsVisible(true);
          } else if (!location.pathname.startsWith("/onboarding") && !location.pathname.startsWith("/admin")) {
            navigate("/dashboard", { replace: true });
            setTimeout(() => setIsVisible(true), 100);
          }
        }
      } catch (e) {
        console.error("Failed to check tour status", e);
      } finally {
        setIsInitializing(false);
      }
    }

    if (isInitializing && !domainsLoading) {
      checkTourStatus();
    }
  }, [user, location.pathname, isInitializing, domainsLoading]);

  // Handle route navigation for steps
  useEffect(() => {
    if (!isVisible || !currentStep) return;

    if (targetRoute && !location.pathname.startsWith(targetRoute.split('?')[0])) {
      // Need to navigate
      navigate(targetRoute);
    }
  }, [currentStepIndex, isVisible, currentStep, navigate, location.pathname, targetRoute]);

  // Measure target element
  useEffect(() => {
    if (!isVisible || !currentStep) return;

    const measure = () => {
      // Try to find the element by data-tour or id
      const el = document.querySelector(`[data-tour="${currentStep.targetId}"]`) || document.getElementById(currentStep.targetId);

      if (el) {
        setTargetRect(el.getBoundingClientRect());
      } else {
        // Element not found on this page yet, might be rendering or wrong page
        setTargetRect(null);
      }
    };

    measure();

    // Setup observer and resize listener
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);

    // Poll just in case the element renders slightly later (React router transitions)
    const interval = setInterval(measure, 500);

    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      clearInterval(interval);
    };
  }, [currentStepIndex, isVisible, currentStep, location.pathname]);

  const handleNext = () => {
    if (currentStepIndex < activeSteps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const handleComplete = async () => {
    setIsVisible(false);
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 3500);

    toast.success(
      <span className="font-bold text-white text-[13px] tracking-wide relative z-10 px-1 drop-shadow-md flex items-center gap-2">
        ✨ You're all set! Start using the dashboard.
      </span>,
      {
        duration: 4000,
        style: {
          background: "linear-gradient(to right, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.95))",
          backdropFilter: "blur(10px)",
          border: "1px solid rgba(56, 189, 248, 0.4)",
          boxShadow: "0 0 20px rgba(56, 189, 248, 0.2), inset 0 0 10px rgba(56, 189, 248, 0.1)",
          color: "#fff",
          padding: "12px 16px",
          borderRadius: "12px",
        }
      }
    );
    try {
      await saveOnboardingData({ dashboard_tour_completed: true });
    } catch (e) {
      console.error("Failed to save tour completion", e);
    }
  };

  if (!isVisible && !showConfetti) return null;

  // Calculate tooltip position
  const padding = 8;
  const overlayPadding = 4;
  let tooltipStyle: React.CSSProperties = {};

  if (targetRect) {
    const position = currentStep?.position || "bottom";

    // Default to bottom
    if (position === "bottom") {
      tooltipStyle = {
        top: targetRect.bottom + padding,
        left: Math.max(16, targetRect.left + (targetRect.width / 2) - 140),
      };
    } else if (position === "right") {
      tooltipStyle = {
        top: Math.max(16, targetRect.top + (targetRect.height / 2) - 100),
        left: targetRect.right + padding,
      };
    } else if (position === "left") {
      tooltipStyle = {
        top: Math.max(16, targetRect.top + (targetRect.height / 2) - 100),
        right: window.innerWidth - targetRect.left + padding,
      };
    } else if (position === "top") {
      tooltipStyle = {
        bottom: window.innerHeight - targetRect.top + padding,
        left: Math.max(16, targetRect.left + (targetRect.width / 2) - 140),
      };
    }

    // Ensure it doesn't go offscreen horizontally
    if (tooltipStyle.left && (tooltipStyle.left as number) + 280 > window.innerWidth - 16) {
      tooltipStyle.left = window.innerWidth - 296;
    }
  }

  return (
    <>
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-[10005] overflow-hidden">
          {Array.from({ length: 40 }).map((_, i) => {
            const spread = (Math.random() - 0.5) * window.innerWidth;
            return (
              <motion.div
                key={i}
                initial={{
                  y: -30,
                  x: window.innerWidth / 2,
                  opacity: 1,
                  rotate: Math.random() * 360
                }}
                animate={{
                  y: window.innerHeight + 100,
                  x: (window.innerWidth / 2) + spread,
                  opacity: 1,
                  rotate: Math.random() * 360 + 720
                }}
                transition={{
                  duration: 1.2 + Math.random() * 1.5,
                  ease: "easeIn",
                }}
                className="absolute top-0 shadow-sm"
                style={{
                  width: `${6 + Math.random() * 4}px`,
                  height: `${12 + Math.random() * 14}px`,
                  backgroundColor: ['#38bdf8', '#818cf8', '#c084fc', '#34d399', '#f472b6', '#fbbf24'][i % 6],
                  borderRadius: '2px'
                }}
              />
            );
          })}
        </div>
      )}

      {isVisible && currentStep && (
        <div className={`fixed inset-0 z-[9999] pointer-events-none transition-opacity duration-300 ${targetRect ? 'opacity-100' : 'opacity-0'}`}>
          {/* Dimming overlay with cutout */}
          <div
            className="absolute inset-0 bg-slate-950/70 transition-all duration-300 ease-out pointer-events-auto"
            style={{
              clipPath: targetRect
                ? `polygon(
                    0% 0%, 0% 100%, 
                    ${targetRect.left - overlayPadding}px 100%, 
                    ${targetRect.left - overlayPadding}px ${targetRect.top - overlayPadding}px, 
                    ${targetRect.right + overlayPadding}px ${targetRect.top - overlayPadding}px, 
                    ${targetRect.right + overlayPadding}px ${targetRect.bottom + overlayPadding}px, 
                    ${targetRect.left - overlayPadding}px ${targetRect.bottom + overlayPadding}px, 
                    ${targetRect.left - overlayPadding}px 100%, 
                    100% 100%, 100% 0%
                  )`
                : "none"
            }}
          />

          {/* Target highlight ring */}
          {targetRect && (
            <motion.div
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="absolute border-[2px] border-sky-400 rounded-lg shadow-[0_0_20px_rgba(56,189,248,0.5)] pointer-events-none z-[10000]"
              style={{
                top: targetRect.top - overlayPadding,
                left: targetRect.left - overlayPadding,
                width: targetRect.width + overlayPadding * 2,
                height: targetRect.height + overlayPadding * 2,
              }}
            >
              {/* Pulsing inner ring */}
              <div className="absolute inset-[-6px] rounded-lg border border-sky-400/30 animate-pulse" />
            </motion.div>
          )}

          {/* Tooltip Popup */}
          <AnimatePresence mode="wait">
            {targetRect && (
              <motion.div
                key={currentStep.id}
                initial={{ opacity: 0, y: 15, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
                transition={{ type: "spring", damping: 22, stiffness: 300 }}
                className="absolute w-[300px] bg-slate-900/95 backdrop-blur-xl border border-slate-700/60 shadow-[0_15px_40px_rgba(0,0,0,0.6),_0_0_25px_rgba(56,189,248,0.15)] rounded-xl overflow-hidden pointer-events-auto z-[10001]"
                style={tooltipStyle}
              >
                {/* Glowing accent top border */}
                <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-sky-400 via-indigo-500 to-purple-500" />

                {/* Decorative blur blob */}
                <div className="absolute -top-10 -right-10 w-24 h-24 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />

                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/50 relative z-10">
                  <h3 className="font-bold text-slate-100 flex items-center gap-2 text-sm">
                    <span className="flex items-center justify-center w-[20px] h-[20px] rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 text-[10px] text-white shadow-lg shadow-sky-500/20 font-extrabold">
                      {currentStepIndex + 1}
                    </span>
                    {currentStep.title}
                  </h3>
                  <button
                    onClick={handleComplete}
                    className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus:outline-none"
                    aria-label="Close tour"
                  >
                    <X size={14} strokeWidth={2.5} />
                  </button>
                </div>

                {/* Content */}
                <div className="px-4 py-3 text-base text-slate-300 relative z-10 min-h-[50px]">
                  {currentStep.content}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-3 py-2 bg-slate-950/40 relative z-10 border-t border-slate-800/40">
                  <div className="flex items-center gap-1">
                    {activeSteps.map((_, idx) => (
                      <div
                        key={idx}
                        className={`h-1 rounded-full transition-all duration-300 ${idx === currentStepIndex ? 'w-4 bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.7)]' : 'w-1 bg-slate-700'}`}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handleComplete}
                      className="px-2 py-1 text-[11px] font-semibold text-slate-400 hover:text-white transition-colors"
                    >
                      Skip
                    </button>

                    <div className="flex items-center gap-0.5 bg-slate-800/50 p-0.5 rounded-md border border-slate-700/50 shadow-inner">
                      {currentStepIndex > 0 && (
                        <button
                          onClick={handlePrev}
                          className="p-1 text-slate-300 hover:text-white hover:bg-slate-700/80 rounded transition-all"
                        >
                          <ChevronLeft size={13} strokeWidth={3} />
                        </button>
                      )}

                      <button
                        onClick={handleNext}
                        className="flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-white text-[11px] font-bold rounded shadow-[0_0_12px_rgba(14,165,233,0.4)] hover:shadow-[0_0_20px_rgba(14,165,233,0.6)] transition-all active:scale-95"
                      >
                        {currentStepIndex === activeSteps.length - 1 ? "Finish" : "Next"}
                        {currentStepIndex < activeSteps.length - 1 && <ChevronRight size={13} className="stroke-[3]" />}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </>
  );
}
