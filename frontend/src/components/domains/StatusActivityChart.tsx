import { useState } from "react";
import DateTimeDisplay from "../common/date-time-display";
import { useNavigate } from "react-router-dom";

type StatusBucket = {
    bucket_start: string;
    status: 'up' | 'down';
    incident_ulid?: string | null;
};

type StatusActivityChartProps = {
    buckets: StatusBucket[];
};

export function StatusActivityChart({ buckets }: StatusActivityChartProps) {
    const navigate = useNavigate();
    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

    if (!buckets.length) {
        return (
            <div className="h-52 flex items-center justify-center text-slate-400 text-sm">
                No status activity in this range.
            </div>
        );
    }

    return (
        <div className="relative px-4 py-4">
            <div className="flex flex-wrap gap-1 justify-center mx-auto">
                {buckets.map((b, idx) => (
                    <div
                        key={idx}
                        onMouseEnter={() => setHoveredIdx(idx)}
                        onMouseLeave={() => setHoveredIdx(null)}
                        onClick={() => b.incident_ulid && navigate(`/incidents/${b.incident_ulid}`)}
                        className={`relative w-5 h-5 rounded-full transition
                            ${b.status === 'up'
                                ? 'bg-emerald-500 hover:bg-emerald-400'
                                : 'bg-rose-500 hover:bg-rose-400'}
                            ${hoveredIdx === idx ? 'ring-2 ring-offset-1 ring-offset-slate-900' : ''}
                            ${b.incident_ulid ? 'cursor-pointer' : ''}
                        `}
                    >
                        {hoveredIdx === idx && (
                            <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2">
                                <div className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs whitespace-nowrap">
                                    <div className={`font-semibold ${b.status === 'up' ? 'text-emerald-400' : 'text-rose-400'
                                        }`}>
                                        {b.status.toUpperCase()}
                                    </div>
                                    <DateTimeDisplay value={b.bucket_start} />
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className="flex items-center justify-center gap-4 mt-4 text-xs text-slate-400">
                <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-emerald-500 rounded-sm" /> Up
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-rose-500 rounded-sm" /> Down
                </div>
            </div>
        </div>
    );
}
