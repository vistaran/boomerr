import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Logo from '../assets/logo-5.png';

const envApi = import.meta.env.VITE_API_BASE_URL;
const resolvedApiBase = (import.meta.env.PROD || !envApi || envApi.includes('localhost:8000'))
  ? (typeof window !== 'undefined' ? `${window.location.origin}/api` : '/api')
  : envApi;

const publicApi = axios.create({
  baseURL: resolvedApiBase,
});

interface DailyBar {
  date: string;
  status: 'operational' | 'down' | 'nodata';
  uptime_percentage?: number | null;
}

interface DomainData {
  id: number;
  name: string;
  status: string;
  uptime_percentage: number;
  daily_bars: DailyBar[];
}

interface StatusPageData {
  name: string;
  logo_path: string | null;
  overall_status: 'operational' | 'down';
  domains: DomainData[];
  last_updated: string;
}

export default function PublicStatusPageView() {
  const { slug } = useParams<{ slug: string }>();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['publicStatusPage', slug],
    queryFn: async () => {
      const res = await publicApi.get(`/status-pages/public/${slug}`);
      return res.data as StatusPageData;
    },
    refetchInterval: 60000, // Refetch every minute
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4 relative overflow-hidden font-sans">
        {/* Background Gradients */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-rose-500/10 pointer-events-none"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/20 blur-[100px] rounded-full pointer-events-none"></div>

        {/* Logo */}
        <div className="flex items-center gap-3 mb-8 sm:mb-10 z-10">
          <div className="flex-shrink-0 h-12 w-12 sm:h-14 sm:w-14 flex items-center justify-center rounded-xl sm:rounded-2xl bg-slate-900 border border-slate-800 shadow-xl shadow-indigo-500/10 p-2">
            <img src={Logo} alt="Boomerr Logo" className="h-full w-full object-contain" />
          </div>
          <span className="text-xl sm:text-2xl font-extrabold tracking-tight text-white drop-shadow-md">Boomerr</span>
        </div>

        {/* Card */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl p-6 sm:p-8 max-w-lg w-full text-center relative z-10">
          <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto bg-slate-800/50 rounded-full flex items-center justify-center mb-4 sm:mb-6 border border-slate-700/50 shadow-inner">
            <AlertCircle className="w-8 h-8 sm:w-10 sm:h-10 text-slate-400" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 mb-2 sm:mb-3 tracking-tight">Status Page Not Found</h1>
          <p className="text-slate-400 mb-6 sm:mb-8 text-sm sm:text-base leading-relaxed">
            The status page you are looking for does not exist, has been removed, or is not currently published by its owner.
          </p>
          <a
            href="/"
            className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-sm font-medium rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/25 w-full sm:w-auto"
          >
            Go to Dashboard
          </a>
        </div>

        {/* Footer */}
        <div className="mt-10 sm:mt-12 text-center text-xs sm:text-sm text-slate-500 z-10">
          Powered by <a href="/" className="font-semibold text-slate-400 hover:text-indigo-400 transition-colors">Boomerr Community Edition</a>
        </div>
      </div>
    );
  }

  const isAllOperational = data.overall_status === 'operational';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30">
      {/* Header section with modern glassmorphic look */}
      <div className="relative pt-12 pb-32 px-4 sm:px-6 lg:px-8 border-b border-slate-800/60 bg-slate-900 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-emerald-500/5"></div>
        <div className="max-w-4xl mx-auto flex justify-between items-center relative z-10">
          <div className="flex items-center gap-3">
            {data.logo_path ? (
              <img src={data.logo_path} alt={data.name} className="h-8 w-auto" />
            ) : (
              <div className="text-xl font-bold text-white">{data.name}</div>
            )}
          </div>
          <div className="text-right">
            <div className="text-sm font-medium text-white">Service status</div>
            <div className="text-xs text-gray-400 mt-1">
              Last updated {formatDistanceToNow(new Date(data.last_updated), { addSuffix: true })}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16 relative z-10 pb-12">

        {/* Overall Status Banner */}
        <div className="rounded-2xl shadow-2xl p-8 mb-12 flex flex-col sm:flex-row items-center sm:items-start gap-6 bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 relative overflow-hidden">
          <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${isAllOperational ? 'from-emerald-400 to-teal-500' : 'from-rose-400 to-orange-500'}`}></div>
          {isAllOperational ? (
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
              <CheckCircle2 className="w-7 h-7 text-emerald-400" />
            </div>
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center flex-shrink-0 shadow-[0_0_15px_rgba(244,63,94,0.2)]">
              <XCircle className="w-7 h-7 text-rose-400" />
            </div>
          )}
          <div className="text-center sm:text-left">
            <h2 className="text-3xl font-bold text-slate-100 mb-2 tracking-tight">
              {isAllOperational ? 'All systems online' : 'Some systems are experiencing issues'}
            </h2>
            <p className="text-slate-400 text-sm">
              {isAllOperational ? 'No active incidents were recorded recently.' : 'Our engineers are currently investigating the issue.'}
            </p>
          </div>
        </div>

        {/* Services List */}
        <div className="mb-8">
          <h3 className="text-xl font-semibold text-white mb-4">Services</h3>

          <div className="bg-slate-900/60 rounded-2xl shadow-lg border border-slate-800/80 backdrop-blur-sm">
            <ul className="divide-y divide-slate-800/60">
              {data.domains.map((domain) => {
                const isDomainOperational = domain.status === 'UP' || String(domain.status).startsWith('2') || String(domain.status).startsWith('3');
                return (
                  <li key={domain.id} className="p-6 sm:p-8 hover:bg-slate-800/30 transition-colors">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-4">
                      <div className="flex items-center gap-3">
                        <h4 className="text-lg font-semibold text-slate-100">{domain.name}</h4>
                        <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${domain.uptime_percentage >= 99 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-orange-500/10 text-orange-400 border-orange-500/20'}`}>
                          {domain.uptime_percentage === 100 ? '100.00' : (Math.floor(domain.uptime_percentage * 100) / 100).toFixed(2)}% Uptime
                        </span>
                      </div>
                      <div className={`flex items-center text-sm font-medium px-3 py-1.5 rounded-lg bg-slate-950/50 border border-slate-800/50 shadow-inner ${isDomainOperational ? 'text-emerald-400' : 'text-rose-400'}`}>
                        <div className="relative flex h-2.5 w-2.5 mr-2.5 items-center justify-center">
                          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isDomainOperational ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                          <span className={`relative inline-flex rounded-full h-2 w-2 shadow-sm ${isDomainOperational ? 'bg-emerald-500 shadow-emerald-500/50' : 'bg-rose-500 shadow-rose-500/50'}`}></span>
                        </div>
                        {isDomainOperational ? 'Online' : 'Experiencing Issues'}
                      </div>
                    </div>

                    {/* Uptime Bar */}
                    <div className="flex gap-1 h-12 items-end">
                      {domain.daily_bars.map((bar, index) => {
                        let barBg = 'bg-slate-700/50 hover:bg-slate-600';
                        let textCol = 'text-slate-400';

                        if (bar.status !== 'nodata') {
                          if (bar.status === 'operational' || bar.uptime_percentage === 100) {
                            barBg = 'bg-emerald-500/80 hover:bg-emerald-400';
                            textCol = 'text-emerald-400';
                          } else if (bar.uptime_percentage && bar.uptime_percentage > 0) {
                            barBg = 'bg-amber-500/80 hover:bg-amber-400';
                            textCol = 'text-amber-400';
                          } else {
                            barBg = 'bg-rose-500/80 hover:bg-rose-400';
                            textCol = 'text-rose-400';
                          }
                        }

                        return (
                          <div
                            key={index}
                            className={`group flex-1 rounded-sm ${barBg} h-full transition-all duration-200 cursor-pointer relative hover:-translate-y-0.5`}
                          >
                            {/* Custom Tooltip */}
                            <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 px-3 py-2 bg-slate-800 text-slate-200 text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-20 transition-all duration-200 ring-1 ring-white/10 scale-95 group-hover:scale-100 origin-bottom">
                              <span className="block font-medium text-slate-100 mb-1">{bar.date}</span>
                              <span className={textCol}>
                                {bar.status === 'nodata' ? 'No records' : `${bar.uptime_percentage === 100 ? '100.00' : (Math.floor((bar.uptime_percentage ?? 0) * 100) / 100).toFixed(2)}% Uptime`}
                              </span>
                              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-800"></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between text-xs font-medium text-slate-500 mt-3 px-1">
                      <span>30 days ago</span>
                      <span>Today</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row justify-between items-center text-xs text-slate-500 mt-12 pt-8 border-t border-slate-800/60 pb-12">
          <div className="flex items-center gap-1.5 mb-4 sm:mb-0">
            <span>Status page powered by</span>
            <a href="/" className="flex items-center gap-1.5 font-semibold text-slate-200 hover:text-indigo-400 transition-colors group">
              <img src={Logo} alt="Boomerr Logo" className="h-4 w-4 sm:h-5 sm:w-5 opacity-90 group-hover:scale-110 transition-transform" />
              <span>Boomerr</span>
            </a>
          </div>
          <div className="flex space-x-4">
            <a href="/status" className="font-semibold text-slate-300 hover:text-indigo-400 transition-colors">System Status</a>
            <a href="https://github.com/vistaran/boomerr" target="_blank" rel="noreferrer" className="hover:text-slate-400 transition-colors">GitHub</a>
          </div>
        </div>

      </div>
    </div>
  );
}
