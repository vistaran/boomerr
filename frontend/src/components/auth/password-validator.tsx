import { Check, X } from "lucide-react";

interface PasswordValidatorProps {
    password: string;
}

export const PasswordValidator = ({ password }: PasswordValidatorProps) => {
    const requirements = [
        {
            label: "At least one uppercase letter",
            met: /[A-Z]/.test(password),
        },
        {
            label: "At least one lowercase letter",
            met: /[a-z]/.test(password),
        },
        {
            label: "At least one number",
            met: /[0-9]/.test(password),
        },
        {
            label: "At least one special character",
            met: /[^A-Za-z0-9]/.test(password),
        },
    ];
    
    // Hide component if all rules are satisfied
    const allMet = requirements.every(req => req.met);
    if (allMet) return null;

    return (
        <div className="mt-2 rounded-xl border border-slate-700 bg-slate-900/80 p-4 shadow-xl backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-200">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Password must meet:
            </p>
            <ul className="space-y-2">
                {requirements.map((req, index) => (
                    <li
                        key={index}
                        className={`flex items-center gap-2 text-sm transition-colors duration-200 ${req.met ? "text-emerald-400" : "text-slate-400"
                            }`}
                    >
                        {req.met ? (
                            <div className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                                <Check size={12} strokeWidth={3} />
                            </div>
                        ) : (
                            <div className="flex h-4 w-4 items-center justify-center rounded-full bg-rose-500/20 text-rose-400">
                                <X size={12} strokeWidth={3} />
                            </div>
                        )}
                        <span className={req.met ? "font-medium" : "text-slate-400"}>
                            {req.label}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
};
