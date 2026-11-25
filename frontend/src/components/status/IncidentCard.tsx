import React from 'react';
import { AlertCircle, CheckCircle2, Clock, ShieldAlert } from 'lucide-react';

export interface IncidentItem {
  id: number;
  incident_id?: string;
  incident_title: string;
  incident_status: 'investigating' | 'identified' | 'monitoring' | 'resolved' | string;
  incident_impact?: string | null;
  incident_cause?: string | null;
  incident_affected_services?: string[];
  incident_started_at?: string;
  incident_resolved_at?: string | null;
  duration?: string | null;
}

interface IncidentCardProps {
  incident: IncidentItem;
}

export const IncidentCard: React.FC<IncidentCardProps> = ({ incident }) => {
  const getStatusStyle = () => {
    switch (incident.incident_status) {
      case 'resolved':
        return {
          label: 'Resolved',
          text: 'text-emerald-400',
          dot: 'bg-emerald-400',
          icon: CheckCircle2,
          badgeBg: 'bg-emerald-500/10 border-emerald-500/20',
          borderAccent: 'bg-emerald-500',
        };
      case 'monitoring':
        return {
          label: 'Monitoring Fix',
          text: 'text-blue-400',
          dot: 'bg-blue-400',
          icon: Clock,
          badgeBg: 'bg-blue-500/10 border-blue-500/20',
          borderAccent: 'bg-blue-500',
        };
      case 'identified':
        return {
          label: 'Cause Identified',
          text: 'text-amber-400',
          dot: 'bg-amber-400',
          icon: AlertCircle,
          badgeBg: 'bg-amber-500/10 border-amber-500/20',
          borderAccent: 'bg-amber-500',
        };
      default:
        return {
          label: 'Investigating',
          text: 'text-rose-400',
          dot: 'bg-rose-400',
          icon: ShieldAlert,
          badgeBg: 'bg-rose-500/10 border-rose-500/20',
          borderAccent: 'bg-rose-500',
        };
    }
  };

  const statusStyle = getStatusStyle();
  const IconComp = statusStyle.icon;

  return (
    <div className="rounded-xl border border-white/[0.06] hover:bg-white/[0.02] transition-colors duration-200 space-y-4 overflow-hidden relative"
      style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.7) 0%, rgba(5,11,20,0.9) 100%)' }}>
      {/* Left color accent bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${statusStyle.borderAccent}`} />

      <div className="pl-6 pr-5 pt-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/[0.05]">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${statusStyle.badgeBg} border border-white/[0.04] flex-shrink-0`}>
              <IconComp className={`w-4 h-4 ${statusStyle.text}`} />
            </div>
            <h3 className="text-sm font-semibold text-slate-100 tracking-wide">{incident.incident_title}</h3>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {incident.duration && (
              <span className="text-[11px] text-slate-600 font-mono bg-white/[0.03] px-2 py-0.5 rounded-md border border-white/[0.04]">
                {incident.duration}
              </span>
            )}
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full border text-[11px] font-bold uppercase tracking-wider ${statusStyle.badgeBg} ${statusStyle.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
              {statusStyle.label}
            </div>
          </div>
        </div>

        <div className="space-y-3 py-4">
          {incident.incident_impact && (
            <div>
              <h4 className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-1.5">Impact</h4>
              <p className="text-sm text-slate-300 leading-relaxed">{incident.incident_impact}</p>
            </div>
          )}

          {incident.incident_cause && (
            <div>
              <h4 className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-1.5">Root Cause</h4>
              <p className="text-sm text-slate-400 leading-relaxed">{incident.incident_cause}</p>
            </div>
          )}
        </div>
      </div>

      {incident.incident_affected_services && incident.incident_affected_services.length > 0 && (
        <div className="flex items-center gap-3 px-6 pb-3">
          <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">Affected</span>
          <div className="flex flex-wrap gap-2">
            {incident.incident_affected_services.map((svc, idx) => (
              <span key={idx} className="px-2.5 py-0.5 text-[11px] font-mono bg-white/[0.04] text-slate-300 rounded-lg border border-white/[0.06]">
                {svc}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="text-[10px] font-mono text-slate-600 px-6 py-3 border-t border-white/[0.04] flex justify-between bg-black/20">
        <span>Started: {incident.incident_started_at ? new Date(incident.incident_started_at).toLocaleString() : 'N/A'}</span>
        {incident.incident_resolved_at && (
          <span>Resolved: {new Date(incident.incident_resolved_at).toLocaleString()}</span>
        )}
      </div>
    </div>
  );
};
