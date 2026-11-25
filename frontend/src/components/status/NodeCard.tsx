import React from 'react';
import { CheckCircle, Zap, Globe, Wifi, WifiOff, AlertOctagon } from 'lucide-react';
import type { NodeStatus } from './WorldMap';

interface NodeCardProps {
  node: NodeStatus;
}

export const NodeCard: React.FC<NodeCardProps> = ({ node }) => {
  const getStatusConfig = () => {
    switch (node.status) {
      case 'healthy':
        return {
          label: 'Healthy',
          badgeClass: 'bg-sky-500/15 text-sky-300 border-sky-500/25',
          glow: 'rgba(56,189,248,0.18)',
          borderColor: 'rgba(56,189,248,0.2)',
          orbColor: 'rgba(56,189,248,0.25)',
          shimmer: 'from-sky-500/0 via-sky-400/10 to-sky-500/0',
          dotColor: 'bg-sky-400',
          dotGlow: '0 0 8px rgba(56,189,248,0.8)',
          Icon: Wifi,
          iconColor: 'text-sky-400',
          cardGrad: 'linear-gradient(135deg, rgba(56,189,248,0.06) 0%, rgba(15,23,42,0.92) 50%, rgba(5,11,20,0.97) 100%)',
          latencyColor: 'text-sky-300',
        };
      case 'degraded':
        return {
          label: 'Degraded',
          badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/25',
          glow: 'rgba(245,158,11,0.18)',
          borderColor: 'rgba(245,158,11,0.25)',
          orbColor: 'rgba(245,158,11,0.2)',
          shimmer: 'from-amber-500/0 via-amber-400/10 to-amber-500/0',
          dotColor: 'bg-amber-400',
          dotGlow: '0 0 8px rgba(245,158,11,0.8)',
          Icon: AlertOctagon,
          iconColor: 'text-amber-400',
          cardGrad: 'linear-gradient(135deg, rgba(245,158,11,0.06) 0%, rgba(15,23,42,0.92) 50%, rgba(5,11,20,0.97) 100%)',
          latencyColor: 'text-amber-300',
        };
      case 'down':
        return {
          label: 'Offline',
          badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/25',
          glow: 'rgba(239,68,68,0.18)',
          borderColor: 'rgba(239,68,68,0.25)',
          orbColor: 'rgba(239,68,68,0.2)',
          shimmer: 'from-rose-500/0 via-rose-400/10 to-rose-500/0',
          dotColor: 'bg-rose-400',
          dotGlow: '0 0 8px rgba(239,68,68,0.8)',
          Icon: WifiOff,
          iconColor: 'text-rose-400',
          cardGrad: 'linear-gradient(135deg, rgba(239,68,68,0.06) 0%, rgba(15,23,42,0.92) 50%, rgba(5,11,20,0.97) 100%)',
          latencyColor: 'text-rose-400',
        };
      default:
        return {
          label: 'Unknown',
          badgeClass: 'bg-slate-700 text-slate-400 border-slate-600',
          glow: 'rgba(100,116,139,0.1)',
          borderColor: 'rgba(100,116,139,0.2)',
          orbColor: 'rgba(100,116,139,0.15)',
          shimmer: 'from-slate-500/0 via-slate-400/8 to-slate-500/0',
          dotColor: 'bg-slate-500',
          dotGlow: '0 0 6px rgba(100,116,139,0.6)',
          Icon: Globe,
          iconColor: 'text-slate-500',
          cardGrad: 'linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(5,11,20,0.97) 100%)',
          latencyColor: 'text-slate-400',
        };
    }
  };

  const cfg = getStatusConfig();
  const StatusIcon = cfg.Icon;

  return (
    <div className="relative group h-full">
      {/* Ambient glow on hover */}
      <div
        className="absolute -inset-1 rounded-2xl blur-2xl opacity-0 group-hover:opacity-60 transition-opacity duration-700 -z-10"
        style={{ background: `radial-gradient(ellipse, ${cfg.glow} 0%, transparent 70%)` }}
      />

      <div
        className="rounded-2xl h-full flex flex-col overflow-hidden transform group-hover:-translate-y-1.5 transition-all duration-300 relative"
        style={{
          background: cfg.cardGrad,
          border: `1px solid ${cfg.borderColor}`,
          boxShadow: `0 0 25px ${cfg.glow}, 0 1px 0 rgba(255,255,255,0.04) inset`,
        }}
      >
        {/* Diagonal shimmer stripe across card */}
        <div
          className={`absolute inset-0 bg-gradient-to-br ${cfg.shimmer} opacity-60 pointer-events-none`}
          style={{ transform: 'skewY(-12deg) translateY(-20%)' }}
        />

        {/* Top-right glowing orb decoration */}
        <div
          className="absolute -top-6 -right-6 w-20 h-20 rounded-full blur-2xl pointer-events-none opacity-50 group-hover:opacity-80 transition-opacity duration-500"
          style={{ background: `radial-gradient(circle, ${cfg.orbColor} 0%, transparent 70%)` }}
        />

        {/* Card content */}
        <div className="relative z-10 p-4 flex flex-col h-full">

          {/* Header: status icon + badge */}
          <div className="flex items-start justify-between gap-2 mb-3">
            {/* Big status icon */}
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: `rgba(255,255,255,0.04)`,
                border: `1px solid ${cfg.borderColor}`,
              }}
            >
              <StatusIcon className={`w-4.5 h-4.5 ${cfg.iconColor}`} />
            </div>

            {/* Status badge with glowing dot */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider flex-shrink-0 ${cfg.badgeClass}`}>
              <span
                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dotColor} ${node.status === 'healthy' ? 'animate-pulse' : ''}`}
                style={{ boxShadow: cfg.dotGlow }}
              />
              {cfg.label}
            </div>
          </div>

          {/* Node name + region */}
          <div className="mb-4">
            <h3 className="text-sm font-bold text-white leading-tight tracking-wide">{node.name}</h3>
            <div className="flex items-center gap-1.5 mt-1">
              <Globe className="w-3 h-3 text-slate-600" />
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">{node.aws_region}</span>
            </div>
          </div>

          {/* Divider with gradient */}
          <div
            className="h-px mb-3 mt-auto"
            style={{ background: `linear-gradient(90deg, transparent, ${cfg.borderColor}, transparent)` }}
          />

          {/* Metrics row */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">Latency</span>
              <span className={`text-xs font-bold font-mono flex items-center gap-1 ${cfg.latencyColor}`}>
                <Zap className="w-3 h-3" />
                {node.latency_ms !== null && node.latency_ms !== undefined ? `${node.latency_ms}ms` : '-'}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 items-end">
              <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">24h</span>
              <span className="text-xs font-bold font-mono flex items-center gap-1 text-emerald-400">
                <CheckCircle className="w-3 h-3" />
                {node.success_rate_24h !== null && node.success_rate_24h !== undefined ? `${node.success_rate_24h}%` : '100%'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
