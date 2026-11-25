import { Sparkles } from "lucide-react";

export function ChatTitle({ chatLenth }: { chatLenth?: number }) {
    return (
        <div className="px-4 py-2.5 border-b border-slate-700/40 bg-slate-900/80 backdrop-blur-sm">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    <div className="flex items-center gap-2">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span className="text-sm font-semibold text-slate-200">Boomerr Agent</span>
                        <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    </div>
                </div>
                {chatLenth && chatLenth > 0 && (
                    <span className="text-xs text-slate-500 bg-slate-800/40 px-2 py-0.5 rounded-md">
                        {Math.ceil((chatLenth + 1) / 2)}
                    </span>
                )}
            </div>
        </div>
    );
}