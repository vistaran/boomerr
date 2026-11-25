import React, { useState, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine, Dot
} from 'recharts';
import { TrendingUp } from 'lucide-react';

interface AggregateUptimeChartProps {
  services: any[];
}

export const AggregateUptimeChart: React.FC<AggregateUptimeChartProps> = ({ services }) => {
  const [window, setWindow] = useState<'7d' | '30d' | '90d'>('30d');

  const chartData = useMemo(() => {
    if (!services || services.length === 0) return [];

    const bars = services[0].daily_bars || [];
    const numDays = window === '7d' ? 7 : window === '30d' ? 30 : 90;
    const relevantBars = bars.slice(Math.max(0, bars.length - numDays));

    return relevantBars.map((bar: any, index: number) => {
      let totalUptime = 0;
      let validServicesCount = 0;

      services.forEach((svc) => {
        const svcBar = svc.daily_bars?.[index + (bars.length - relevantBars.length)];
        if (svcBar && svcBar.status !== 'nodata') {
          totalUptime += svcBar.uptime;
          validServicesCount++;
        }
      });

      const avgUptime = validServicesCount > 0 ? totalUptime / validServicesCount : 100;

      return {
        date: bar.date,
        uptime: Number(avgUptime.toFixed(2)),
        status: avgUptime >= 99.9 ? 'healthy' : avgUptime >= 99.0 ? 'degraded' : 'down',
      };
    });
  }, [services, window]);

  const aggregateUptimeValue = useMemo(() => {
    if (chartData.length === 0) return 100;
    const sum = chartData.reduce((acc: number, curr: any) => acc + curr.uptime, 0);
    return (sum / chartData.length).toFixed(2);
  }, [chartData]);

  const yDomainMin = useMemo(() => {
    if (chartData.length === 0) return 0;
    const minUptime = Math.min(...chartData.map((d: any) => d.uptime));
    return Math.max(Math.floor(minUptime) - 5, 0);
  }, [chartData]);

  /* Custom glowing dot on the line */
  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    const isDown = payload.uptime < 99.0;
    const isDegraded = payload.uptime >= 99.0 && payload.uptime < 99.9;
    const fill = isDown ? '#ef4444' : isDegraded ? '#f59e0b' : '#3b82f6';
    const glow = isDown
      ? '0 0 6px rgba(239,68,68,0.8)'
      : isDegraded
      ? '0 0 6px rgba(245,158,11,0.8)'
      : '0 0 8px rgba(59,130,246,0.9)';
    return (
      <circle
        cx={cx}
        cy={cy}
        r={3.5}
        fill={fill}
        stroke="rgba(0,0,0,0.5)"
        strokeWidth={1.5}
        style={{ filter: `drop-shadow(${glow})` }}
      />
    );
  };

  /* Custom tooltip */
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const isDown = data.uptime < 99.0;
      const isDegraded = data.uptime < 99.9;
      const color = isDown ? '#ef4444' : isDegraded ? '#f59e0b' : '#3b82f6';
      return (
        <div className="bg-[#0a1628]/95 backdrop-blur-xl border border-white/[0.08] px-4 py-3 rounded-xl shadow-2xl">
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1.5">
            {data.date}
          </p>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }} />
            <p className="text-white font-mono font-bold text-sm">
              {data.uptime}%
              <span className="font-sans font-normal text-slate-500 text-xs ml-1">avg uptime</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div
      className="rounded-2xl border border-white/[0.07] overflow-hidden shadow-2xl"
      style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.85) 0%, rgba(5,11,20,0.95) 100%)' }}
    >
      {/* Header */}
      <div
        className="px-6 py-5 border-b border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-5"
        style={{ background: 'linear-gradient(90deg, rgba(37,99,235,0.08) 0%, transparent 60%)' }}
      >
        <div className="flex items-center gap-4">
          <div className="w-1 h-8 rounded-full bg-gradient-to-b from-blue-400 to-indigo-600" />
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-bold text-slate-100 tracking-wide">System Availability</h2>
              <div className="flex items-center gap-1.5 bg-blue-600/15 border border-blue-500/30 px-2.5 py-0.5 rounded-full">
                <TrendingUp className="w-3 h-3 text-blue-400" />
                <span className="text-[11px] font-bold text-blue-400 font-mono">{aggregateUptimeValue}%</span>
              </div>
            </div>
            <p className="text-slate-500 text-xs mt-0.5 font-medium">Average uptime across all services</p>
          </div>
        </div>

        <div className="flex bg-white/[0.03] p-1 rounded-xl border border-white/[0.05] w-fit shadow-inner">
          {(['7d', '30d', '90d'] as const).map((opt) => (
            <button
              key={opt}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 ${
                window === opt
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]'
              }`}
              onClick={() => setWindow(opt)}
            >
              {opt === '7d' ? '7 Days' : opt === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="px-4 pt-4 pb-2 h-72">
        {chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-600 text-sm">
            No uptime data available yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
              <defs>
                {/* Brand royal blue gradient fill */}
                <linearGradient id="uptimeAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                  <stop offset="60%" stopColor="#2563eb" stopOpacity={0.08} />
                  <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.0} />
                </linearGradient>
                {/* Glow filter for the line */}
                <filter id="lineGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="2.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.04)"
                horizontal={true}
                vertical={false}
              />

              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#475569', fontWeight: 500 }}
                dy={8}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[yDomainMin, 100]}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#475569', fontWeight: 500 }}
                tickFormatter={(val) => `${val}%`}
                width={40}
                tickCount={5}
              />

              <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.08)', strokeWidth: 1, strokeDasharray: '4 4' }} />

              <ReferenceLine y={99.9} stroke="rgba(59,130,246,0.2)" strokeDasharray="4 4" />

              <Area
                type="monotoneX"
                dataKey="uptime"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#uptimeAreaGrad)"
                dot={<CustomDot />}
                activeDot={{ r: 5, fill: '#60a5fa', stroke: 'rgba(0,0,0,0.5)', strokeWidth: 2, style: { filter: 'drop-shadow(0 0 10px rgba(59,130,246,1))' } }}
                filter="url(#lineGlow)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Legend */}
      <div className="px-6 pb-4 flex items-center gap-5 text-[10px] text-slate-500 font-medium">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-500" style={{ boxShadow: '0 0 6px rgba(59,130,246,0.8)' }} />
          <span className="text-slate-400">Healthy ≥ 99.9%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400" style={{ boxShadow: '0 0 6px rgba(245,158,11,0.8)' }} />
          <span>Degraded ≥ 99%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-rose-400" style={{ boxShadow: '0 0 6px rgba(239,68,68,0.8)' }} />
          <span>Outage &lt; 99%</span>
        </div>
      </div>
    </div>
  );
};
