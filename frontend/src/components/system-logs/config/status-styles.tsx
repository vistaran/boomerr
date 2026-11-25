import { AlertCircle, CheckCircle2, RotateCw, MinusCircle, XCircle } from "lucide-react";
import type { ReactNode } from "react";

export const STATUS_STYLES: Record<
  string,
  { icon: ReactNode; color: string }
> = {
  success: {
    icon: <CheckCircle2 size={12} />,
    color: "text-emerald-400",
  },
  failure: {
    icon: <XCircle size={12} />,
    color: "text-rose-400",
  },
  skipped: {
    icon: <MinusCircle size={12} />,
    color: "text-slate-400",
  },
  pending: {
    icon: <RotateCw size={12} className="animate-spin" />,
    color: "text-amber-300",
  },
  info: {
    icon: <AlertCircle size={12} />,
    color: "text-sky-400",
  },
};
