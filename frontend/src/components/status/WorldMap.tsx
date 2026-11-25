import React from 'react';
import { Server } from 'lucide-react';
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker
} from "react-simple-maps";

export interface NodeStatus {
  node_id: string;
  aws_region: string;
  name: string;
  label: string;
  lat: number;
  lng: number;
  status: 'healthy' | 'degraded' | 'down' | string;
  latency_ms?: number | null;
  checks_run_24h?: number | null;
  success_rate_24h?: number | null;
  last_heartbeat_ago_s?: number | null;
}

interface WorldMapProps {
  nodes: NodeStatus[];
}

const geoUrl = "/world-110m.json";

export const WorldMap: React.FC<WorldMapProps> = ({ nodes }) => {
  const [hoveredNode, setHoveredNode] = React.useState<NodeStatus | null>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return { fill: '#3b82f6', ring: 'rgba(59, 130, 246, 0.45)', text: 'text-blue-400', badge: 'bg-blue-600/15 text-blue-300 border-blue-500/30' };
      case 'degraded':
        return { fill: '#f59e0b', ring: 'rgba(245, 158, 11, 0.4)', text: 'text-amber-400', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
      case 'down':
        return { fill: '#ef4444', ring: 'rgba(239, 68, 68, 0.4)', text: 'text-rose-400', badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20' };
      default:
        return { fill: '#64748b', ring: 'rgba(100, 116, 139, 0.4)', text: 'text-slate-400', badge: 'bg-slate-800 text-slate-400' };
    }
  };

  return (
    <div
      className="rounded-2xl border border-white/[0.07] overflow-hidden shadow-2xl"
      style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(5,11,20,0.95) 100%)' }}
    >
      <div
        className="px-6 py-5 border-b border-white/[0.06] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        style={{ background: 'linear-gradient(90deg, rgba(37,99,235,0.08) 0%, transparent 60%)' }}
      >
        <div className="flex items-center gap-4">
          <div className="w-1 h-8 rounded-full bg-gradient-to-b from-blue-400 to-indigo-600" />
          <div>
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2 tracking-wide">
              <Server className="w-4 h-4 text-blue-400" />
              Global Monitoring Infrastructure
            </h2>
            <p className="text-slate-500 text-xs mt-0.5">Real-time telemetry across 5 AWS multi-region execution nodes</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs font-medium bg-white/[0.03] border border-white/[0.05] px-4 py-2 rounded-xl">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" style={{ boxShadow: '0 0 6px rgba(59,130,246,0.8)' }} />
            <span className="text-slate-400">Healthy</span>
          </div>
          <div className="w-px h-3 bg-white/[0.08]" />
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-slate-400">Degraded</span>
          </div>
          <div className="w-px h-3 bg-white/[0.08]" />
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-400" />
            <span className="text-slate-400">Offline</span>
          </div>
        </div>
      </div>
      <div className="p-6">

      {/* Map Container */}
      <div className="relative w-full rounded-xl border border-white/[0.05] bg-[#020617]/90 overflow-hidden shadow-2xl backdrop-blur-xl">
        {/* Hover Information Banner / Popover */}
        {hoveredNode && (
          <div className="absolute top-4 right-4 z-20 bg-slate-900/90 border border-white/10 backdrop-blur-md px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-3 transition-all animate-fade-in">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getStatusColor(hoveredNode.status).fill }} />
            <div>
              <div className="text-xs font-bold text-white uppercase tracking-wider">{hoveredNode.label} ({hoveredNode.aws_region})</div>
              <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                <span>Latency: <strong className="text-slate-200">{hoveredNode.latency_ms ? `${hoveredNode.latency_ms}ms` : 'N/A'}</strong></span>
                <span>•</span>
                <span>Status: <strong className="text-slate-200 capitalize">{hoveredNode.status}</strong></span>
              </div>
            </div>
          </div>
        )}

        <div className="w-full relative z-10 p-2 sm:p-4">
          <ComposableMap
            projection="geoMercator"
            projectionConfig={{ scale: 125, center: [0, 25] }}
            className="w-full h-auto"
            style={{ maxHeight: '440px' }}
          >
            <defs>
              {/* High-tech glow filters */}
              <filter id="nodeGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
              
              {/* Telemetry arc gradient */}
              <linearGradient id="telemetryLine" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.1" />
                <stop offset="50%" stopColor="#60a5fa" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.1" />
              </linearGradient>
            </defs>

            <Geographies geography={geoUrl}>
              {({ geographies }) =>
                geographies.map((geo) => (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill="#151e2e"
                    stroke="#1e293b"
                    strokeWidth={0.8}
                    style={{
                      default: { outline: "none" },
                      hover: { fill: "#1e2c42", outline: "none", transition: "all 200ms" },
                      pressed: { outline: "none" },
                    }}
                  />
                ))
              }
            </Geographies>

            {/* Flight / Telemetry Connecting Curves between Nodes */}
            {nodes.length > 1 && (
              <g className="pointer-events-none opacity-40">
                {nodes.map((source, i) => {
                  const target = nodes[(i + 1) % nodes.length];
                  return (
                    <line
                      key={`arc-${source.node_id}-${target.node_id}`}
                      x1={source.lng}
                      y1={source.lat}
                      x2={target.lng}
                      y2={target.lat}
                      stroke="url(#telemetryLine)"
                      strokeWidth={1}
                      strokeDasharray="4 6"
                    />
                  );
                })}
              </g>
            )}

            {nodes.map((node) => {
              const statusStyle = getStatusColor(node.status);
              const isHovered = hoveredNode?.node_id === node.node_id;

              return (
                <Marker
                  key={node.node_id}
                  coordinates={[node.lng, node.lat]}
                  onMouseEnter={() => setHoveredNode(node)}
                  onMouseLeave={() => setHoveredNode(null)}
                  className="cursor-pointer group"
                >
                  {/* Outer Radar Wave Pulse */}
                  <circle
                    r={22}
                    fill={statusStyle.fill}
                    fillOpacity={0.12}
                    className="animate-ping opacity-40 origin-center"
                  />
                  {/* Secondary Halo */}
                  <circle
                    r={12}
                    fill={statusStyle.fill}
                    fillOpacity={0.2}
                    className="transition-all duration-300 group-hover:scale-125"
                  />
                  {/* Outer Tech Ring */}
                  <circle
                    r={7}
                    fill="#0a0f1d"
                    stroke={statusStyle.fill}
                    strokeWidth={2}
                    filter="url(#nodeGlow)"
                  />
                  {/* Core Indicator Dot */}
                  <circle
                    r={3.5}
                    fill={statusStyle.fill}
                  />

                  {/* High-Contrast Location Badge */}
                  <g transform="translate(0, -18)">
                    <rect
                      x={-(node.label.length * 4.2 + 8)}
                      y={-14}
                      width={node.label.length * 8.4 + 16}
                      height={18}
                      rx={5}
                      fill="#030712"
                      fillOpacity={0.88}
                      stroke={isHovered ? statusStyle.fill : "rgba(255,255,255,0.12)"}
                      strokeWidth={1}
                      className="transition-all duration-200"
                    />
                    <text
                      y={-2}
                      textAnchor="middle"
                      fill={isHovered ? "#ffffff" : "#cbd5e1"}
                      fontSize={9.5}
                      fontWeight={700}
                      letterSpacing="0.04em"
                      className="font-mono select-none"
                    >
                      {node.label.toUpperCase()}
                    </text>
                  </g>
                </Marker>
              );
            })}
          </ComposableMap>
        </div>
      </div>
      </div>
    </div>
  );
};
