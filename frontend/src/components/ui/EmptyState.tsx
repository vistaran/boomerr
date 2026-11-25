import type { ReactNode } from "react";

interface EmptyStateProps {
    title: string;
    description?: string;
    action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
    return (
        <div className="flex h-full min-h-96 flex-col items-center justify-center text-center px-3 sm:px-6 py-8 sm:py-12">
            <div className="max-w-md w-full">
                <h2 className="text-lg sm:text-xl font-semibold text-slate-100">
                    {title}
                </h2>

                {description && (
                    <p className="mt-2 text-sm text-slate-400">
                        {description}
                    </p>
                )}

                {action && (
                    <div className="mt-6">
                        {action}
                    </div>
                )}
            </div>
        </div>
    );
}
