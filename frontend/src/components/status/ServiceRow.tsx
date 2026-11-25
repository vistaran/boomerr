import React, { useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { UptimeChart } from './UptimeChart';

export interface ServiceStatusItem {
  service_id: string;
  service_name: string;
  status: 'operational' | 'degraded' | 'down' | string;
  uptime_7d?: number | null;
  uptime_30d?: number | null;
  uptime_90d?: number | null;
  checks_today?: number;
  failures_today?: number;
  updated_at?: string;
  daily_bars?: Array<{ date: string; uptime: number; status: string }>;
}

interface ServiceRowProps {
  service: ServiceStatusItem;
}

export const ServiceRow: React.FC<ServiceRowProps> = ({ service }) => {
  const [expanded, setExpanded] = useState(false);

  const getStatusStyle = () => {
    switch (service.status) {
      case 'operational':
        return {
          label: 'Operational',
          icon: CheckCircle2,
          text: 'text-blue-400',
          bg: 'bg-blue-600/10',
          dot: 'bg-blue-500',
          border: 'bg-blue-600',
          badgeBg: 'bg-blue-600/15 border-blue-500/30 text-blue-300',
        };
      case 'degraded':
        return {
          label: 'Degraded',
          icon: AlertTriangle,
          text: 'text-amber-400',
          bg: 'bg-amber-500/10',
          dot: 'bg-amber-400',
          border: 'bg-amber-500',
          badgeBg: 'bg-amber-500/10 border-amber-500/20',
        };
      case 'down':
        return {
          label: 'Service Down',
          icon: XCircle,
          text: 'text-rose-400',
          bg: 'bg-rose-500/10',
          dot: 'bg-rose-400',
          border: 'bg-rose-500',
          badgeBg: 'bg-rose-500/10 border-rose-500/20',
        };
      default:
        return {
          label: 'Unknown',
          icon: CheckCircle2,
          text: 'text-slate-500',
          bg: 'bg-slate-800',
          dot: 'bg-slate-500',
          border: 'bg-slate-600',
          badgeBg: 'bg-slate-800 border-slate-700',
        };
    }
  };

  const statusStyle = getStatusStyle();
  const IconComp = statusStyle.icon;

  return (
    <div className="border-b border-white/[0.04] last:border-0 group relative">
      {/* Colored left accent bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${statusStyle.border} opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-r-full`} />

      <div
        className="px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer select-none bg-transparent hover:bg-white/[0.025] transition-all duration-200 pl-7"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-4">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${statusStyle.bg} border border-white/[0.04]`}>
            <IconComp className={`w-4.5 h-4.5 ${statusStyle.text}`} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">{service.service_name}</h3>
            <span className="text-xs text-slate-600 mt-0.5 block font-mono">
              {service.checks_today ?? 0} checks · {service.failures_today ?? 0} failures today
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-8">
          <div className="hidden md:flex items-center gap-8 text-sm">
            {[
              { label: '7d', value: service.uptime_7d },
              { label: '30d', value: service.uptime_30d },
              { label: '90d', value: service.uptime_90d },
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col items-end">
                <span className="text-[10px] text-slate-600 font-bold uppercase tracking-wider mb-0.5">{label}</span>
                <span className="text-slate-200 font-mono text-xs font-semibold">{value ? `${value}%` : '100%'}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 min-w-[150px] justify-end">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-semibold ${statusStyle.badgeBg} ${statusStyle.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot} ${service.status === 'operational' ? 'animate-pulse' : ''}`} />
              {statusStyle.label}
            </div>
            <button className="text-slate-600 hover:text-slate-300 transition-colors bg-white/[0.03] hover:bg-white/[0.06] rounded-lg p-1.5">
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      <div className={`overflow-hidden transition-all duration-300 ${expanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="mx-6 mb-5 rounded-xl border border-white/[0.05] bg-black/30 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.05] flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">30-Day Historical Trend</span>
            <div className="flex items-center gap-2">
              <span className="text-slate-600 text-xs">Average:</span>
              <span className="font-mono text-blue-400 font-bold text-xs">{service.uptime_30d ?? 100}%</span>
            </div>
          </div>
          <div className="px-4 py-3">
            <UptimeChart dailyBars={service.daily_bars} uptime30d={service.uptime_30d} />
          </div>
        </div>
      </div>
    </div>
  );
};
