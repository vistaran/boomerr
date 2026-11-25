import { useNavigate } from "react-router-dom";
import { CheckCircle2, ArrowRight, PlusCircle, BellRing, ShieldAlert, Sparkles, ChevronLeft, CreditCard } from "lucide-react";
import { OnboardingProgress } from "./OnboardingProgress";
import { motion } from "framer-motion";
import { useAuth } from "../../context/auth-context";
import { useOnboardingData, getSuggestions, clearOnboardingCache } from "../../hooks/useOnboardingData";
import { saveOnboardingData } from "../../services/api-service";
import toast from "react-hot-toast";

// Icon mapping
const suggestionIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  BellRing,
  ShieldAlert,
  PlusCircle,
};

export function SetupCompletePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: onboardingData, loading } = useOnboardingData();
  const suggestions = getSuggestions(onboardingData);

  const handleDashboard = async () => {
    try {
      await saveOnboardingData({ onboarding_completed: true });
      clearOnboardingCache();
      // If there's a stored redirect (from when user first tried to open a protected route), use it
      try {
        const stored = localStorage.getItem("redirectPath");
        if (stored && stored !== "/login") {
          // Clear it so we don't reuse it later
          localStorage.removeItem("redirectPath");
          try {
            const url = new URL(stored, window.location.origin);
            // Remove temporary auth flag if present
            url.searchParams.delete('auth');
            const cleaned = url.pathname + (url.search ? url.search : '');
            navigate(cleaned, { replace: true });
            return;
          } catch (e) {
            // If URL parsing fails, fallback to raw stored string
            navigate(stored, { replace: true });
            return;
          }
        }
      } catch (e) {
        console.error("Error reading redirectPath:", e);
      }

      navigate("/overview");
    } catch (err: any) {
      toast.error(err.message || "Failed to save onboarding completion");
      console.error("Failed to mark onboarding as complete:", err);
      // Still navigate even if saving fails
      try {
        const stored = localStorage.getItem("redirectPath");
        if (stored && stored !== "/login") {
          localStorage.removeItem("redirectPath");
          try {
            const url = new URL(stored, window.location.origin);
            url.searchParams.delete('auth');
            const cleaned = url.pathname + (url.search ? url.search : '');
            navigate(cleaned, { replace: true });
            return;
          } catch (e) {
            navigate(stored, { replace: true });
            return;
          }
        }
      } catch (e) {
        console.error("Error reading redirectPath:", e);
      }
      navigate("/overview");
    }
  };

  const handleSelectPlan = () => {
    navigate("/billing");
  };

  if (loading) {
    return null;
  }

  return (
    <div className="w-full flex flex-col items-center">
      <OnboardingProgress currentStep={5} />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="max-w-3xl w-full bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden text-center"
      >
        {/* Back Button */}
        <button 
          type="button"
          onClick={() => navigate("/onboarding/add-domain")} 
          className="absolute top-8 left-8 flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors z-20"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back
        </button>
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="flex justify-center mb-6 relative">
          <div className="absolute inset-0 bg-emerald-500/20 blur-[30px] rounded-full w-16 h-16 mx-auto" />
          <CheckCircle2 className="w-16 h-16 text-emerald-400 relative z-10" />
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-2 flex items-center justify-center gap-2">
          Your monitoring is ready! <Sparkles className="w-6 h-6 text-amber-400" />
        </h1>
        <p className="text-sm sm:text-base text-slate-400 max-w-lg mx-auto leading-relaxed mb-6">
          Boomerr is now monitoring your website. You'll receive alerts if any issues are detected.
        </p>

        <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4 mb-6 mx-auto text-left max-w-md">
          <ul className="space-y-3">
            <li className="flex items-center justify-between text-slate-300">
              <span className="font-medium text-slate-400 text-sm">Monitoring Status</span>
              <span className="flex items-center text-emerald-400 font-semibold bg-emerald-400/10 px-2 py-0.5 rounded-full text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
                Active
              </span>
            </li>
            <li className="flex items-center justify-between text-slate-300">
              <span className="font-medium text-slate-400 text-sm">Checks Enabled</span>
              <span className="font-semibold text-white text-sm">Uptime, SSL, Security</span>
            </li>
          </ul>
        </div>

        <div className="mb-6 text-left">
          <h3 className="text-sm font-bold text-white mb-3 ml-1 border-l-2 border-indigo-500 pl-2">
            Optional Next Steps
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {suggestions.map((suggestion) => {
              const Icon = suggestionIconMap[suggestion.icon] || BellRing;
              return (
                <div
                  key={suggestion.label}
                  className="flex flex-col items-center bg-slate-800/30 border border-slate-700/50 rounded-lg p-2 text-center group hover:bg-slate-800/50 transition-colors"
                >
                  <div className={`p-1.5 rounded-lg mb-1.5 ${suggestion.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-[11px] font-medium text-slate-300 group-hover:text-white transition-colors leading-tight">
                    {suggestion.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-center gap-3">
          <button
            onClick={handleDashboard}
            className="flex-1 flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-emerald-500 hover:shadow-[0_0_15px_rgba(16,185,129,0.4)] focus:outline-none"
          >
            Go to Dashboard
            <ArrowRight className="h-4 w-4" />
          </button>

          <button
            onClick={handleSelectPlan}
            className="flex-1 flex items-center justify-center gap-2 rounded-full bg-slate-800 border border-slate-700 px-6 py-3 text-sm font-semibold text-slate-300 transition-all hover:text-white hover:bg-slate-700 focus:outline-none"
          >
            Select Plan
            <CreditCard className="h-4 w-4" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
