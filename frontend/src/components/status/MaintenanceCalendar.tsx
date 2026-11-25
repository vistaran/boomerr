import React from 'react';
import { Calendar, CheckCircle2, Clock, Wrench } from 'lucide-react';

interface MaintenanceWindow {
  id: number;
  title: string;
  component: string;
  start_time: string;
  end_time: string;
  status: 'upcoming' | 'in_progress' | 'completed' | 'cancelled';
}

interface MaintenanceCalendarProps {
  maintenance: MaintenanceWindow[];
}

export const MaintenanceCalendar: React.FC<MaintenanceCalendarProps> = ({ maintenance }) => {
  if (!maintenance || maintenance.length === 0) return null;

  return (
    <div
      className="rounded-2xl border border-white/[0.07] overflow-hidden shadow-2xl"
      style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.85) 0%, rgba(5,11,20,0.95) 100%)' }}
    >
      <div
        className="px-6 py-5 border-b border-white/[0.06] flex items-center gap-4"
        style={{ background: 'linear-gradient(90deg, rgba(99,102,241,0.08) 0%, transparent 60%)' }}
      >
        <div className="w-1 h-6 rounded-full bg-gradient-to-b from-indigo-400 to-violet-600" />
        <h2 className="text-sm font-bold text-slate-200 tracking-wide flex items-center gap-2">
          <Wrench className="w-4 h-4 text-indigo-400" />
          Scheduled Maintenance
        </h2>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/[0.05]">
            <tr>
              {['Date', 'Window (UTC)', 'Component', 'Status'].map((col) => (
                <th key={col} className="px-6 py-3 text-[10px] font-bold text-slate-600 uppercase tracking-widest">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03]">
            {maintenance.map((item) => {
              const startDate = new Date(item.start_time);
              const endDate = new Date(item.end_time);
              const dateStr = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
              
              const formatTime = (d: Date) => d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
              const windowStr = `${formatTime(startDate)} – ${formatTime(endDate)}`;
              
              const isCompleted = item.status === 'completed';
              const isUpcoming = item.status === 'upcoming';
              const isInProgress = item.status === 'in_progress';

              return (
                <tr key={item.id} className="hover:bg-white/[0.02] transition-colors duration-200 group">
                  <td className="px-6 py-4 text-slate-200 font-semibold text-sm">{dateStr}</td>
                  <td className="px-6 py-4 text-slate-500 font-mono text-xs">{windowStr}</td>
                  <td className="px-6 py-4 text-slate-300 text-sm">{item.component}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border
                      ${isCompleted ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : ''}
                      ${isUpcoming ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : ''}
                      ${isInProgress ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : ''}
                      ${item.status === 'cancelled' ? 'bg-slate-800 text-slate-500 border-slate-700' : ''}
                    `}>
                      {isCompleted && <CheckCircle2 className="w-3 h-3" />}
                      {(isUpcoming || isInProgress) && <Clock className={`w-3 h-3 ${isInProgress ? 'animate-pulse' : ''}`} />}
                      {item.status.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
