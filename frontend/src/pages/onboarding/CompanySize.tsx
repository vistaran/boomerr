import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Building2 } from "lucide-react";
import { OnboardingProgress } from "./OnboardingProgress";
import { OnboardingCard, OnboardingHeader, OnboardingContinueButton } from "./components/OnboardingComponents";
import { useOnboardingData, getCompanySizes, clearOnboardingCache } from "../../hooks/useOnboardingData";
import { saveOnboardingData } from "../../services/api-service";
import toast from "react-hot-toast";

export function CompanySizePage() {
  const navigate = useNavigate();
  const { data: onboardingData, loading } = useOnboardingData();
  const options = getCompanySizes(onboardingData);

  const [selected, setSelected] = useState<string | null>(
    onboardingData?.selections?.company_size ?? null
  );

  useEffect(() => {
    const savedCompanySize = onboardingData?.selections?.company_size;
    if (typeof savedCompanySize === "string") {
      setSelected(savedCompanySize);
    }
  }, [onboardingData?.selections?.company_size]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleNext = async (value: string) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await saveOnboardingData({ selections: { company_size: value } });
      clearOnboardingCache();
      navigate("/onboarding/hear-about");
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
      <OnboardingProgress currentStep={2} />

      <OnboardingCard backUrl="/onboarding/plan">
        <OnboardingHeader
          title={
            <div className="flex items-center gap-2.5">
              <span>How big is your company?</span>
              <div className="p-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-emerald-400" strokeWidth={2} />
              </div>
            </div>
          }
          subtitle="We'll tailor collaboration features for your setup"
          isCentered={true}
        />

        {/* 2-Column Grid Layout like screenshot */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
          {options.map((opt, idx) => {
            const isSelected = selected === opt.id;

            return (
              <motion.div
                key={opt.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 + idx * 0.03 }}
                onClick={() => {
                  setSelected(opt.id);
                  handleNext(opt.id);
                }}
                className={`group flex items-center justify-center gap-2 px-6 py-5 rounded-xl border transition-all duration-200 cursor-pointer text-base font-semibold tracking-wide text-center ${isSelected
                  ? "bg-indigo-950/40 border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.1)] text-white"
                  : "bg-slate-800/40 border-slate-800 hover:border-slate-700/80 hover:bg-slate-800/60 text-slate-200 hover:text-white"
                  }`}
              >
                <span>{opt.label}</span>
                {opt.range && <span className="text-slate-500 font-normal"> {opt.range}</span>}
              </motion.div>
            );
          })}
        </div>

        {/* Auto-continues on select */}
      </OnboardingCard>
    </div>
  );
}
