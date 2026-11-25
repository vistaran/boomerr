import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Wrench, ShieldCheck } from 'lucide-react';

interface StatusBannerProps {
  status: 'operational' | 'degraded' | 'major_outage' | 'maintenance' | string;
  lastCheckedAt?: string;
  uptime30d?: number;
}

export const StatusBanner: React.FC<StatusBannerProps> = ({ status, lastCheckedAt, uptime30d }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'operational':
        return {
          title: 'All Systems Operational',
          subtitle: 'All global monitoring nodes, core services, and telemetry pipelines are running normally.',
          icon: CheckCircle2,
          iconColor: 'text-emerald-400',
          iconBg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-emerald-950/40',
          dot: 'bg-emerald-400',
          glow: 'rgba(16,185,129,0.12)',
          glowBorder: 'rgba(16,185,129,0.25)',
          badgeBg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
          accentGradient: 'from-emerald-500/0 via-emerald-400/60 to-emerald-500/0',
          radialGlow: '#10b981',
          metricDot: 'bg-emerald-400',
        };
      case 'degraded':
        return {
          title: 'Partial System Degradation',
          subtitle: 'One or more monitoring regions or services are experiencing elevated latency or degraded performance.',
          icon: AlertTriangle,
          iconColor: 'text-amber-400',
          iconBg: 'bg-amber-500/10 border-amber-500/30 text-amber-400 shadow-amber-950/40',
          dot: 'bg-amber-400',
          glow: 'rgba(245,158,11,0.12)',
          glowBorder: 'rgba(245,158,11,0.25)',
          badgeBg: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
          accentGradient: 'from-amber-500/0 via-amber-400/60 to-amber-500/0',
          radialGlow: '#f59e0b',
          metricDot: 'bg-amber-400',
        };
      case 'major_outage':
        return {
          title: 'Major System Outage',
          subtitle: 'Multiple monitoring nodes or core platform services are currently unreachable. Engineering is investigating.',
          icon: XCircle,
          iconColor: 'text-rose-400',
          iconBg: 'bg-rose-500/10 border-rose-500/30 text-rose-400 shadow-rose-950/40',
          dot: 'bg-rose-400',
          glow: 'rgba(244,63,94,0.14)',
          glowBorder: 'rgba(244,63,94,0.28)',
          badgeBg: 'bg-rose-500/10 border-rose-500/30 text-rose-300',
          accentGradient: 'from-rose-500/0 via-rose-400/60 to-rose-500/0',
          radialGlow: '#f43f5e',
          metricDot: 'bg-rose-400',
        };
      case 'maintenance':
        return {
          title: 'Scheduled Maintenance',
          subtitle: 'System infrastructure maintenance is in progress. Some regional checks may be temporarily delayed.',
          icon: Wrench,
          iconColor: 'text-sky-400',
          iconBg: 'bg-sky-500/10 border-sky-500/30 text-sky-400 shadow-sky-950/40',
          dot: 'bg-sky-400',
          glow: 'rgba(56,189,248,0.12)',
          glowBorder: 'rgba(56,189,248,0.25)',
          badgeBg: 'bg-sky-500/10 border-sky-500/30 text-sky-300',
          accentGradient: 'from-sky-500/0 via-sky-400/60 to-sky-500/0',
          radialGlow: '#38bdf8',
          metricDot: 'bg-sky-400',
        };
      default:
        return {
          title: 'Operational Status Unknown',
          subtitle: 'Checking real-time system metrics...',
          icon: ShieldCheck,
          iconColor: 'text-slate-400',
          iconBg: 'bg-slate-800/80 border-slate-700/50 shadow-black/20',
          dot: 'bg-slate-400',
          glow: 'rgba(100,116,139,0.08)',
          glowBorder: 'rgba(100,116,139,0.2)',
          badgeBg: 'bg-slate-800 border-slate-700 text-slate-400',
          accentGradient: 'from-slate-500/0 via-slate-500/40 to-slate-500/0',
          radialGlow: '#64748b',
          metricDot: 'bg-slate-400',
        };
    }
  };

  const config = getStatusConfig();
  const IconComponent = config.icon;

  return (
    <div
      className="rounded-2xl p-6 sm:p-8 relative overflow-hidden border backdrop-blur-xl transition-all duration-300"
      style={{
        background: `linear-gradient(135deg, ${config.glow} 0%, rgba(13,18,30,0.92) 50%, rgba(8,12,20,0.98) 100%)`,
        borderColor: config.glowBorder,
        boxShadow: `0 8px 32px 0 rgba(0, 0, 0, 0.37), 0 0 40px ${config.glow}, inset 0 1px 0 rgba(255,255,255,0.05)`,
      }}
    >
      {/* Top accent glowing gradient line */}
      <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${config.accentGradient}`} />
      
      {/* Ambient background light spheres */}
      <div
        className="absolute -top-16 -left-16 w-64 h-64 rounded-full blur-3xl opacity-25 pointer-events-none"
        style={{ background: `radial-gradient(circle, ${config.radialGlow} 0%, transparent 70%)` }}
      />
      <div
        className="absolute -bottom-16 -right-16 w-64 h-64 rounded-full blur-3xl opacity-15 pointer-events-none"
        style={{ background: `radial-gradient(circle, ${config.radialGlow} 0%, transparent 70%)` }}
      />

      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          {/* Status Icon */}
          <div className="relative flex-shrink-0">
            <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center ${config.iconBg} border shadow-lg backdrop-blur-md`}>
              <IconComponent className={`w-7 h-7 sm:w-8 sm:h-8 ${config.iconColor}`} />
            </div>
            <div
              className="absolute inset-0 rounded-2xl blur-xl opacity-50"
              style={{ background: config.glow }}
            />
          </div>

          {/* Title and Description */}
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white tracking-tight">
                {config.title}
              </h1>
              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[11px] font-semibold uppercase tracking-wider ${config.badgeBg}`}>
                <span
                  className={`w-2 h-2 rounded-full ${config.dot} animate-pulse`}
                  style={{ boxShadow: `0 0 6px ${config.radialGlow}` }}
                />
                {status.replace('_', ' ')}
              </div>
            </div>
            <p className="text-slate-300/80 text-xs sm:text-sm max-w-2xl leading-relaxed font-normal">
              {config.subtitle}
            </p>
          </div>
        </div>

        {/* 30-Day Metric Card */}
        {uptime30d !== undefined && (
          <div className="w-full lg:w-auto flex lg:flex-col items-center lg:items-end justify-between pt-4 lg:pt-0 border-t lg:border-t-0 border-white/[0.08] flex-shrink-0 pl-0 lg:pl-8 lg:border-l lg:border-white/[0.08]">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${config.metricDot}`} />
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">
                30-Day Availability
              </span>
            </div>
            <span
              className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white font-mono tracking-tight tabular-nums"
              style={{ textShadow: `0 0 20px ${config.glow}` }}
            >
              {uptime30d.toFixed(2)}%
            </span>
            {lastCheckedAt && (
              <span className="text-[10px] text-slate-500 font-mono mt-1">
                Checked {new Date(lastCheckedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
