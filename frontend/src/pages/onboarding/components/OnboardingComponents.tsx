import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface OnboardingCardProps {
  children: React.ReactNode;
  backUrl?: string;
  maxWidth?: string; // e.g., max-w-5xl (default), max-w-3xl, etc.
  glowColor?: string; // e.g., bg-indigo-500/10 (default), bg-emerald-500/10
}

export function OnboardingCard({ 
  children, 
  backUrl, 
  maxWidth = "max-w-5xl",
  glowColor = "bg-indigo-500/10"
}: OnboardingCardProps) {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className={`${maxWidth} w-full bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 sm:p-12 shadow-2xl relative overflow-hidden`}
    >
      {backUrl && (
        <button 
          type="button"
          onClick={() => navigate(backUrl)} 
          className="absolute top-8 left-8 flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors z-20 outline-none focus:outline-none"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back
        </button>
      )}

      <div className={`absolute top-0 right-0 w-64 h-64 ${glowColor} rounded-full blur-[100px] pointer-events-none`} />
      
      {children}
    </motion.div>
  );
}

interface OnboardingHeaderProps {
  title: React.ReactNode;
  subtitle?: string;
  isCentered?: boolean;
}

export function OnboardingHeader({ title, subtitle, isCentered = false }: OnboardingHeaderProps) {
  return (
    <div className={`${isCentered ? "text-center" : "text-left"} mb-10 mt-6`}>
      <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2 flex items-center justify-center gap-2">
        {title}
      </h1>
      {subtitle && (
        <p className={`text-sm text-slate-400 leading-relaxed ${isCentered ? "max-w-md mx-auto" : "max-w-xl"}`}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

interface OnboardingContinueButtonProps {
  onClick: () => void;
  isLoading?: boolean;
  label?: string;
  className?: string;
}

export function OnboardingContinueButton({ 
  onClick, 
  isLoading = false, 
  label = "Continue",
  className = ""
}: OnboardingContinueButtonProps) {
  return (
    <div className="flex justify-center">
      <AnimatePresence>
        <motion.button
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          onClick={onClick}
          className={`group flex items-center justify-center gap-2 rounded-full bg-blue-600 px-8 py-3.5 text-base font-semibold text-white transition-all hover:bg-blue-500 hover:shadow-[0_0_25px_rgba(37,99,235,0.4)] focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-slate-900 ${className}`}
        >
          {label}
          <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </motion.button>
      </AnimatePresence>
    </div>
  );
}
