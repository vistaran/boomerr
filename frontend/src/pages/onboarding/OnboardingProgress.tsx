import { Check } from "lucide-react";

type OnboardingProgressProps = {
  currentStep: number;
};

export function OnboardingProgress({ currentStep }: OnboardingProgressProps) {
  const steps = [
    { label: "Plan", step: 1 },
    { label: "Company", step: 2 },
    { label: "About", step: 3 },
    { label: "Add Domain", step: 4 },
    { label: "Finish", step: 5 },
  ];

  const currentStepData = steps.find((s) => s.step === currentStep);

  return (
    <div className="flex flex-col items-center mb-10 w-full max-w-sm mx-auto px-4">
      {/* Segmented Progress Bar Pills */}
      <div className="flex gap-1.5 w-full">
        {steps.map((s) => {
          const isCompleted = s.step < currentStep;
          const isActive = s.step === currentStep;

          return (
            <div
              key={s.step}
              className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                isCompleted || isActive
                  ? "bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.5)]"
                  : "bg-slate-800"
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}

