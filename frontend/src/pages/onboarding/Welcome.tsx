import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Activity, ShieldCheck, Zap, Rocket } from "lucide-react";
import { OnboardingProgress } from "./OnboardingProgress";
import { OnboardingCard, OnboardingHeader } from "./components/OnboardingComponents";
import { useOnboardingData, getWelcomeHighlights } from "../../hooks/useOnboardingData";

const iconMap: Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  Activity,
  ShieldCheck,
  Zap,
};

export function WelcomePage() {
  const navigate = useNavigate();
  const { data: onboardingData, loading } = useOnboardingData();
  const highlights = getWelcomeHighlights(onboardingData);

  const handleNext = () => {
    navigate("/onboarding/add-domain");
  };

  if (loading) return null;

  return (
    <div className="w-full flex flex-col items-center">
      <OnboardingProgress currentStep={4} />

      <OnboardingCard maxWidth="max-w-4xl" backUrl="/onboarding/hear-about">
        <OnboardingHeader
          title={
            <div className="flex items-center gap-3">
              <span>Welcome to Boomerr</span>
              <span className="animate-bounce">👋</span>
            </div>
          }
          subtitle="Boomerr helps you monitor your websites in real time and automatically prevent revenue loss by pausing ads when your site goes down."
          isCentered={true}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {highlights.map((item: any, idx: number) => {
            const Icon = iconMap[item.icon] || Activity;
            const cardColors = item.color ? item.color.split(' ') : ['text-blue-400', 'bg-blue-500/10', 'border-blue-500/20'];
            
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1, duration: 0.4 }}
                className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 text-center flex flex-col items-center relative group backdrop-blur-sm shadow-xl"
              >
                <div className={`p-3 rounded-2xl mb-4 ${cardColors[1]} ${cardColors[2] || 'border-slate-800'}`}>
                  <Icon className={`w-8 h-8 ${cardColors[0]}`} strokeWidth={1.5} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{item.description}</p>
              </motion.div>
            );
          })}
        </div>

        <div className="flex justify-center">
          <button
            onClick={handleNext}
            className="flex items-center gap-2 px-8 py-3.5 bg-blue-600 hover:bg-blue-500 font-bold rounded-xl text-white transition-all transform hover:scale-105 shadow-xl shadow-blue-500/20"
          >
            Get Started <Rocket className="w-4 h-4 ml-1" />
          </button>
        </div>
      </OnboardingCard>
    </div>
  );
}
