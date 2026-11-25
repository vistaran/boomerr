import { Lock } from "lucide-react";
import { Link } from "react-router-dom";
import type { ReactNode } from "react";

interface PlanLimitGuardProps {
  /** Whether the current plan has access */
  allowed: boolean;
  /** Feature label shown in the upgrade prompt */
  featureLabel?: string;
  children: ReactNode;
  /**
   * "overlay"  - renders children blurred with a lock overlay (default)
   * "hide"     - hides children entirely
   * "inline"   - replaces children with a small inline badge
   */
  variant?: "overlay" | "hide" | "inline";
}

export function PlanLimitGuard({
  allowed,
  featureLabel = "this feature",
  children,
  variant = "overlay",
}: PlanLimitGuardProps) {
  if (allowed) return <>{children}</>;

  if (variant === "hide") return null;

  if (variant === "inline") {
    return (
      <span
        title={`Upgrade your plan to access ${featureLabel}`}
        className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 cursor-not-allowed select-none"
      >
        <Lock size={10} />
        Upgrade
      </span>
    );
  }

  // "overlay" variant - show children blurred with a centred lock card
  return (
    <div className="relative rounded-xl overflow-hidden">
      {/* Blurred children */}
      <div className="pointer-events-none select-none blur-sm opacity-50 saturate-0">
        {children}
      </div>

      {/* Lock overlay */}
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-900/70 backdrop-blur-sm rounded-xl p-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 border border-amber-500/30">
          <Lock size={22} className="text-amber-400" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-100">
            Upgrade to unlock {featureLabel}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            This feature is not available on your current plan.
          </p>
        </div>
        <Link
          to="/billing"
          className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-1.5 text-xs font-semibold text-slate-900 hover:bg-amber-400 transition-colors"
        >
          View Plans
        </Link>
      </div>
    </div>
  );
}
