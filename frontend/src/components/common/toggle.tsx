import { useId } from "react";

export function ToggleSwitch({ checked, onChange, disabled = false, label = "" }) {
    const id = useId();

    return (
        <label
            htmlFor={id}
            className={`flex items-center gap-1 select-none
                ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
            `}
        >
            {label && (
                <span className="text-xs text-slate-400 font-medium mr-1">
                    {label}
                </span>
            )}

            <span className="relative inline-flex w-8 h-4 align-middle">
                <input
                    id={id}
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={e => !disabled && onChange(e.target.checked)}
                    className="sr-only peer"
                />

                {/* Track */}
                <span
                    className={`
                        relative block w-8 h-4 rounded-full
                        transition-all duration-200 ease-in-out
                        ${checked
                            ? 'bg-emerald-400/80 shadow-[inset_0_1px_2px_rgba(255,255,255,0.35),inset_0_-1px_2px_rgba(0,0,0,0.2)]'
                            : 'bg-slate-600/60 shadow-[inset_0_1px_2px_rgba(255,255,255,0.15),inset_0_-1px_2px_rgba(0,0,0,0.25)]'}
                        peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-400
                    `}
                />

                {/* Knob */}
                <span
                    className={`
                        absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white
                        transition-all duration-200 ease-out
                        ${checked
                            ? 'translate-x-4 shadow-[0_2px_4px_rgba(0,0,0,0.25)] ring-2 ring-emerald-400'
                            : 'shadow-[0_1px_3px_rgba(0,0,0,0.3)] ring-1 ring-slate-400'}
                        ${!disabled && 'active:translate-y-[0.5px] active:shadow-[0_1px_2px_rgba(0,0,0,0.35)]'}
                    `}
                />

                {/* Highlight (fake light reflection) */}
                <span
                    className={`
                        pointer-events-none absolute inset-0 rounded-full
                        opacity-0 transition-opacity duration-200
                        ${checked && 'opacity-100'}
                        bg-gradient-to-b from-white/30 to-transparent
                    `}
                />
            </span>
        </label>
    );
}
