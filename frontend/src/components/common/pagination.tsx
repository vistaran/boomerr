import React from 'react';

interface PaginationProps {
    currentPage: number;
    lastPage: number;
    total?: number;
    onPageChange: (page: number) => void;
    className?: string;
    rangeFrom?: number | null;
    rangeTo?: number | null;
}

const Pagination: React.FC<PaginationProps> = ({
    currentPage,
    lastPage,
    total,
    onPageChange,
    className = '',
    rangeFrom,
    rangeTo,
}) => {
    const safeLast = Math.max(1, lastPage);
    const showRange = typeof rangeFrom === 'number' && typeof rangeTo === 'number' && typeof total === 'number';
    return (
        <div className={`flex items-center justify-between border-t border-slate-700/30 px-4 py-2.5 text-xs ${className}`}>
            <span className="text-slate-500">
                {showRange ? `${rangeFrom}-${rangeTo} of ${total}` : `Page ${currentPage} / ${safeLast}${typeof total === 'number' ? ` (${total} total)` : ''}`}
            </span>
            <div className="flex items-center gap-1.5">
                <button
                    className="rounded-md border border-slate-700/50 px-3 py-1 text-slate-300 transition-all hover:border-slate-600 hover:bg-slate-800/50 disabled:opacity-40 disabled:cursor-not-allowed"
                    disabled={currentPage <= 1}
                    onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                >
                    Prev
                </button>
                <span className="px-3 py-1 text-slate-400">
                    {currentPage} / {safeLast}
                </span>
                <button
                    className="rounded-md border border-slate-700/50 px-3 py-1 text-slate-300 transition-all hover:border-slate-600 hover:bg-slate-800/50 disabled:opacity-40 disabled:cursor-not-allowed"
                    disabled={currentPage >= safeLast}
                    onClick={() => onPageChange(Math.min(safeLast, currentPage + 1))}
                >
                    Next
                </button>
            </div>
        </div>
    );
};

export default Pagination;
