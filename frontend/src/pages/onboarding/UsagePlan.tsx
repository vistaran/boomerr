import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, Users, Megaphone, Building, Shield, GraduationCap, Target, User, TrendingUp } from "lucide-react";
import { OnboardingProgress } from "./OnboardingProgress";
import { OnboardingCard, OnboardingHeader, OnboardingContinueButton } from "./components/OnboardingComponents";
import { useOnboardingData, getUsagePlans, clearOnboardingCache } from "../../hooks/useOnboardingData";
import { saveOnboardingData } from "../../services/api-service";
import toast from "react-hot-toast";

// Icon mapping
const iconMap: Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  Sparkles,
  Users,
  Megaphone,
  Building,
  Shield,
  GraduationCap,
  User,
  TrendingUp,
};

export function UsagePlanPage() {
  const navigate = useNavigate();
  const { data: onboardingData, loading } = useOnboardingData();
  const options = getUsagePlans(onboardingData);

  const [selected, setSelected] = useState<string | null>(
    () => {
      const saved = onboardingData?.selections?.usage_plan;
      return saved ? (Array.isArray(saved) ? saved[0] : saved) : null;
    }
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleNext = async (value: string) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await saveOnboardingData({ selections: { usage_plan: [value] } });
      clearOnboardingCache();
      navigate("/onboarding/company-size");
    } catch (err: any) {
      toast.error(err.message || "Failed to save onboarding data");
      console.error("Failed to save onboarding selection to backend:", err);
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return null;
  }

  return (
    <div className="w-full flex flex-col items-center">
      <OnboardingProgress currentStep={1} />

      <OnboardingCard>
        <OnboardingHeader
          title={
            <div className="flex items-center gap-2.5">
              <span>How do you plan to use Boomerr?</span>
              <div className="p-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                <Target className="w-5 h-5 text-indigo-400" strokeWidth={2} />
              </div>
            </div>
          }
          subtitle="We'll tailor monitoring features and updates to your goals"
          isCentered={true}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
          {options.map((opt, idx) => {
            const isSelected = selected === opt.id;
            const Icon = iconMap[opt.icon] || Sparkles;

            return (
              <motion.div
                key={opt.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + idx * 0.05 }}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                onClick={() => {
                  setSelected(opt.id);
                  handleNext(opt.id);
                }}
                className={`group flex flex-col items-center p-6 rounded-2xl border transition-all duration-200 cursor-pointer ${isSelected
                  ? "bg-indigo-950/40 border-indigo-500/50 shadow-[0_0_25px_rgba(99,102,241,0.15)]"
                  : "bg-slate-800/40 border-slate-800 hover:border-slate-700/80 hover:bg-slate-800/60"
                  }`}
              >
                <div
                  className={`p-3 rounded-xl mb-4 transition-transform duration-300 group-hover:scale-110 ${isSelected ? "bg-indigo-500/10" : "bg-slate-700/30"
                    }`}
                >
                  <Icon className={`w-6 h-6 ${opt.color}`} strokeWidth={1.8} />
                </div>

                <h3 className="font-bold text-white mb-1 tracking-tight text-center">
                  {opt.label}
                </h3>
                <p className="text-xs text-slate-400 text-center leading-relaxed">
                  {opt.desc}
                </p>
              </motion.div>
            );
          })}
        </div>

        {/* Auto-continues on select, so we don't need the Continue button */}
      </OnboardingCard>
    </div>
  );
}
