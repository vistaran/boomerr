import React, { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import axios from 'axios';
import { ChevronDown, CheckCircle2, Settings2, History } from 'lucide-react';
import { IncidentCard, type IncidentItem } from './IncidentCard';

const publicApi = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || (typeof window !== 'undefined' ? `${window.location.origin}/api` : '/api'),
});

interface PaginatedIncidents {
  data: IncidentItem[];
  current_page: number;
  next_page_url: string | null;
  prev_page_url: string | null;
  total: number;
  last_page: number;
}

export const IncidentHistory: React.FC = () => {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading } = useQuery<PaginatedIncidents>({
    queryKey: ['incidentsHistory', page, statusFilter, serviceFilter],
    queryFn: async () => {
      const res = await publicApi.get('/status/incidents', {
        params: {
          page,
          ...(statusFilter && { status: statusFilter }),
          ...(serviceFilter && { service: serviceFilter }),
        }
      });
      return res.data;
    },
    placeholderData: keepPreviousData,
  });

  const incidents = data?.data || [];
  const hasMore = !!data?.next_page_url;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between pb-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-1 h-6 rounded-full bg-gradient-to-b from-slate-400 to-slate-600" />
          <h2 className="text-sm font-bold text-slate-200 tracking-wide flex items-center gap-2">
            <History className="w-4 h-4 text-slate-500" />
            Incident History
          </h2>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 border ${
            showFilters
              ? 'bg-blue-600/15 border-blue-500/30 text-blue-400'
              : 'bg-white/[0.03] border-white/[0.06] text-slate-500 hover:text-slate-300 hover:bg-white/[0.05]'
          }`}
        >
          <Settings2 className="w-3.5 h-3.5" />
          Filters
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showFilters ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {showFilters && (
        <div
          className="rounded-xl border border-white/[0.06] p-5 flex flex-wrap gap-5"
          style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.8) 0%, rgba(5,11,20,0.9) 100%)' }}
        >
          <div className="flex flex-col gap-2 flex-1 min-w-[200px]">
            <label className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">Status</label>
            <select
              className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500/50 hover:bg-white/[0.05] transition-colors"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            >
              <option value="" className="bg-[#050B14]">All Statuses</option>
              <option value="resolved" className="bg-[#050B14]">Resolved</option>
              <option value="monitoring" className="bg-[#050B14]">Monitoring</option>
              <option value="identified" className="bg-[#050B14]">Identified</option>
              <option value="investigating" className="bg-[#050B14]">Investigating</option>
            </select>
          </div>
          
          <div className="flex flex-col gap-2 flex-1 min-w-[200px]">
            <label className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">Service</label>
            <select
              className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500/50 hover:bg-white/[0.05] transition-colors"
              value={serviceFilter}
              onChange={(e) => { setServiceFilter(e.target.value); setPage(1); }}
            >
              <option value="" className="bg-[#050B14]">All Services</option>
              <option value="uptime-monitoring" className="bg-[#050B14]">Uptime Monitoring</option>
              <option value="response-time" className="bg-[#050B14]">Response Time</option>
              <option value="ssl-monitoring" className="bg-[#050B14]">SSL Monitoring</option>
              <option value="domain-expiry" className="bg-[#050B14]">Domain Expiry</option>
              <option value="node-us-east-1" className="bg-[#050B14]">Node: N. Virginia (US)</option>
              <option value="node-eu-central-1" className="bg-[#050B14]">Node: Frankfurt (DE)</option>
              <option value="node-ap-south-1" className="bg-[#050B14]">Node: Mumbai (IN)</option>
            </select>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="py-16 text-center">
          <div className="w-8 h-8 rounded-full border-2 border-blue-500/20 border-t-blue-500 animate-spin mx-auto mb-3" />
          <span className="text-sm text-slate-600 font-medium">Loading history...</span>
        </div>
      ) : incidents.length > 0 ? (
        <div className="space-y-3">
          {incidents.map((incident: any) => (
            <IncidentCard key={incident.id} incident={incident} />
          ))}
          
          <div className="flex justify-between items-center pt-5 border-t border-white/[0.05]">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="px-4 py-2 text-xs font-semibold text-slate-500 disabled:opacity-30 hover:bg-white/[0.04] hover:text-white rounded-lg transition-all duration-200 border border-transparent hover:border-white/[0.06]"
            >
              Previous
            </button>
            <span className="text-xs font-mono text-slate-600 bg-white/[0.03] border border-white/[0.05] px-3 py-1 rounded-lg">Page {page}</span>
            <button
              disabled={!hasMore}
              onClick={() => setPage(p => p + 1)}
              className="px-4 py-2 text-xs font-semibold text-slate-500 disabled:opacity-30 hover:bg-white/[0.04] hover:text-white rounded-lg transition-all duration-200 border border-transparent hover:border-white/[0.06]"
            >
              Load More
            </button>
          </div>
        </div>
      ) : (
        <div
          className="rounded-xl border border-white/[0.05] p-14 text-center"
          style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.06) 0%, rgba(5,11,20,0.8) 100%)' }}
        >
          <div className="w-14 h-14 rounded-2xl bg-blue-600/15 border border-blue-500/25 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-7 h-7 text-blue-400 opacity-80" />
          </div>
          <p className="text-slate-300 text-sm font-medium">No incidents reported in this period.</p>
          <p className="text-slate-500 text-xs mt-1">All systems have been running smoothly.</p>
        </div>
      )}
    </div>
  );
};
