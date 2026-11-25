import React from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';

export interface PlatformCheck {
  name: string;
  url: string;
  status: 'up' | 'down';
  latency_ms: number | null;
  http_code: number | null;
}

interface PlatformChecksProps {
  platform: PlatformCheck[];
}

export const PlatformChecks: React.FC<PlatformChecksProps> = ({ platform }) => {
  if (!platform || platform.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-3">
      {platform.map((item, index) => {
        const isUp = item.status === 'up';
        const IconComp = isUp ? CheckCircle2 : XCircle;
        const statusColor = isUp ? 'text-blue-400' : 'text-rose-400';
        const dotColor = isUp ? 'bg-blue-500' : 'bg-rose-400';
        const glowColor = isUp ? 'rgba(37,99,235,0.15)' : 'rgba(239,68,68,0.12)';
        const borderColor = isUp ? 'rgba(59,130,246,0.3)' : 'rgba(239,68,68,0.2)';

        return (
          <div
            key={index}
            className="flex-1 min-w-[200px] rounded-xl p-4 transition-all duration-200 group cursor-default hover:-translate-y-0.5"
            style={{
              background: `linear-gradient(135deg, ${glowColor} 0%, rgba(15,23,42,0.7) 100%)`,
              border: `1px solid ${borderColor}`,
              boxShadow: `0 0 24px ${glowColor}`,
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isUp ? 'bg-blue-600/15 text-blue-400' : 'bg-rose-500/10 text-rose-400'} border ${isUp ? 'border-blue-500/30' : 'border-white/[0.05]'}`}>
                  <IconComp className={`w-4 h-4 flex-shrink-0 ${statusColor}`} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-100">{item.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${dotColor} ${isUp ? 'animate-pulse' : ''}`} style={isUp ? { boxShadow: '0 0 6px rgba(59,130,246,0.8)' } : {}} />
                      <span className={`font-medium ${statusColor}`}>
                        {isUp ? 'Operational' : 'Outage'}
                      </span>
                    </div>
                    {item.latency_ms !== null && (
                      <>
                        <span className="text-slate-700">·</span>
                        <span className="font-mono text-[11px] text-slate-500">{item.latency_ms}ms</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              {item.http_code && (
                <span className="text-[10px] font-mono text-slate-600 bg-white/[0.03] border border-white/[0.04] px-2 py-0.5 rounded-md ml-auto">
                  {item.http_code}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
