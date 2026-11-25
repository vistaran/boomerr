import React, { useState } from 'react';
import { X, Wrench, CalendarPlus } from 'lucide-react';

interface MaintenanceWindow {
  id: number;
  title: string;
  component: string;
  description: string;
  start_time: string;
  end_time: string;
  status: string;
  scheduled_for?: string;
  duration_minutes?: number;
}

interface MaintenanceBannerProps {
  maintenance: MaintenanceWindow[];
}

export const MaintenanceBanner: React.FC<MaintenanceBannerProps> = ({ maintenance }) => {
  const [dismissedIds, setDismissedIds] = useState<number[]>([]);

  const handleDismiss = (id: number) => {
    setDismissedIds((prev) => [...prev, id]);
  };

  if (!maintenance || maintenance.length === 0) return null;

  const activeMaintenance = maintenance.filter((m) => !dismissedIds.includes(m.id));

  if (activeMaintenance.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-50 flex flex-col gap-3 max-w-lg w-full">
      {activeMaintenance.map((item) => {
        const start = new Date(item.start_time || item.scheduled_for || '');
        const end = item.end_time ? new Date(item.end_time) : null;
        const durationMin = item.duration_minutes ?? (end ? Math.round((end.getTime() - start.getTime()) / 60000) : 0);

        return (
          <div key={item.id} className="bg-blue-950/40 border border-blue-500/30 shadow-2xl shadow-blue-900/10 rounded-xl p-4 flex gap-4 animate-in slide-in-from-bottom-5 relative overflow-hidden backdrop-blur-md">
            <div className="absolute top-0 left-0 bottom-0 w-1 bg-blue-500"></div>
            <div className="mt-0.5 text-blue-400">
              <Wrench className="w-5 h-5 animate-pulse" />
            </div>
            <div className="flex-1 text-sm text-blue-100 pr-6">
              <h4 className="font-bold text-base mb-1 text-white">{item.title}</h4>
              <p className="text-blue-300/80 text-xs font-medium mb-3 uppercase tracking-wider">
                {!isNaN(start.getTime()) ? start.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : ''} {durationMin > 0 ? `(${durationMin} MIN)` : ''}
              </p>
              <p className="leading-relaxed text-blue-200/80 mb-2">
                <strong className="text-blue-200 font-semibold">{item.component}</strong> will undergo maintenance. {item.description || 'Checks from this region may be delayed. No impact on other nodes.'}
              </p>
              <div className="text-xs font-mono bg-blue-900/40 border border-blue-500/20 inline-block px-2.5 py-1 rounded-md text-blue-300">
                ID: {item.id}
              </div>
            </div>
            <button 
              onClick={() => handleDismiss(item.id)}
              className="absolute top-3 right-3 text-blue-400 hover:text-white transition-colors bg-blue-900/30 hover:bg-blue-900/60 rounded-md p-1.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
