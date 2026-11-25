import React from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { Activity } from 'lucide-react';

export interface DailyBarItem {
  date: string;
  uptime: number;
  status: 'operational' | 'degraded' | 'nodata' | string;
}

interface UptimeChartProps {
  dailyBars?: DailyBarItem[];
  uptime30d?: number | null;
}

export const UptimeChart: React.FC<UptimeChartProps> = ({ dailyBars }) => {
  const hasData = dailyBars && dailyBars.length > 0 && dailyBars.some(b => b.status !== 'nodata');

  if (!hasData) {
    return (
      <div className="w-full h-24 flex items-center justify-center bg-slate-900/40 rounded-xl border border-slate-800/60 text-slate-500 text-xs font-medium gap-2">
        <Activity className="w-4 h-4 text-slate-600" />
        No historical telemetry available for this 30-day window.
      </div>
    );
  }

  return (
    <div className="w-full h-28 pt-2">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={dailyBars} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
          <defs>
            <linearGradient id="uptimeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis domain={[90, 100]} hide />
          <Tooltip
            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc', fontSize: '12px' }}
            formatter={(value: any) => [`${value}% Uptime`, 'Historical Telemetry']}
          />
          <Area type="monotone" dataKey="uptime" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#uptimeGradient)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
