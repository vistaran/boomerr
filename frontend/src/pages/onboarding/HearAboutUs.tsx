import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Users, MoreHorizontal, Megaphone,
  ShoppingBag, BarChart2, Repeat, Terminal, BookOpen, Server, Share2, Globe, MousePointer, Twitter
} from "lucide-react";
import { OnboardingProgress } from "./OnboardingProgress";
import { OnboardingCard, OnboardingHeader, OnboardingContinueButton } from "./components/OnboardingComponents";
import { useOnboardingData, getHearAboutSources, clearOnboardingCache } from "../../hooks/useOnboardingData";
import { saveOnboardingData } from "../../services/api-service";
import toast from "react-hot-toast";

// Icon mapping
const iconMap: Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  Search,
  ShoppingBag,
  Megaphone,
  BarChart2,
  Repeat,
  Terminal,
  BookOpen,
  Users,
  Server,
  Share2,
  Globe,
  MousePointer,
  Twitter,
  MoreHorizontal,
};

export function HearAboutUsPage() {
  const navigate = useNavigate();
  const { data: onboardingData, loading } = useOnboardingData();
  const options = getHearAboutSources(onboardingData);

  const [selected, setSelected] = useState<string | null>(null);
  const [otherText, setOtherText] = useState("");

  // Update selected and otherText when data loads
  useEffect(() => {
    const saved = onboardingData?.selections?.hear_about;
    if (saved && typeof saved === 'string' && saved.startsWith("other:")) {
      setSelected("other");
      setOtherText(saved.replace("other: ", ""));
    } else if (saved) {
      setSelected(saved);
      setOtherText("");
    } else {
      setSelected(null);
      setOtherText("");
    }
  }, [onboardingData?.selections?.hear_about]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleNext = async (overrideValue?: string) => {
    const valToUse = overrideValue || selected;
    if (valToUse) {
      if (isSubmitting) return;
      setIsSubmitting(true);
      const payload = valToUse === "other" ? `other: ${otherText}` : valToUse;
      try {
        await saveOnboardingData({ selections: { hear_about: payload } });
        clearOnboardingCache();
        navigate("/onboarding/add-domain");
      } catch (err: any) {
        toast.error(err.message || "Failed to save onboarding data");
        console.error("Failed to save onboarding selection to backend:", err);
        setIsSubmitting(false);
      }
    }
  };

  if (loading) {
    return null;
  }

  return (
    <div className="w-full flex flex-col items-center">
      <OnboardingProgress currentStep={3} />

      <OnboardingCard backUrl="/onboarding/company-size">
        <OnboardingHeader
          title={
            <div className="flex items-center gap-2.5">
              <span>How did you hear about us?</span>
              <div className="p-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <Search className="w-5 h-5 text-amber-400" strokeWidth={2} />
              </div>
            </div>
          }
          subtitle="This helps us improve our product"
        />

        {/* Answer chips options using Flex-wrap wrap like screenshot */}
        <div className="flex flex-wrap gap-4 mb-12">
          {options.map((opt, idx) => {
            const isSelected = selected === opt.id;
            const IconComponent = iconMap[opt.icon] || Search;

            return (
              <motion.div
                key={opt.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 + idx * 0.03 }}
                onClick={() => {
                  setSelected(opt.id);
                  if (opt.id !== 'other') {
                    handleNext(opt.id);
                  }
                }}
                className={`group flex items-center gap-3 px-6 py-4 rounded-xl border transition-all duration-200 cursor-pointer text-base font-semibold tracking-wide ${isSelected
                  ? "bg-indigo-950/40 border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.1)] text-white"
                  : "bg-slate-800/40 border-slate-800 hover:border-slate-700/80 hover:bg-slate-800/60 text-slate-300 hover:text-white"
                  }`}
              >
                <div className={`p-1.5 rounded-lg transition-transform duration-200 group-hover:scale-110 ${opt.color}`}>
                  {opt.id === 'twitter' ? (
                    <span className="font-bold text-sm block h-4">X</span>
                  ) : opt.id === 'tiktok' ? (
                    <span className="font-bold text-sm block h-4">♪</span>
                  ) : (
                    <IconComponent className="w-4 h-4" strokeWidth={2} />
                  )}
                </div>
                <span>{opt.label}</span>
              </motion.div>
            );
          })}
        </div>

        <AnimatePresence>
          {selected === "other" && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-8 max-w-md w-full"
            >
              <input
                type="text"
                value={otherText}
                onChange={(e) => setOtherText(e.target.value)}
                placeholder="Please specify..."
                className="w-full px-4 py-3 bg-slate-800/40 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all duration-200"
              />
            </motion.div>
          )}
        </AnimatePresence>



        {/* ── Continue Button ── */}
        {selected === "other" && <OnboardingContinueButton onClick={() => handleNext()} />}
      </OnboardingCard>
    </div>
  );
}
