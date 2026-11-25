import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import Logo from '../assets/logo-5.png';
import { StatusBanner } from '../components/status/StatusBanner';
import { WorldMap } from '../components/status/WorldMap';
import { NodeCard } from '../components/status/NodeCard';
import { ServiceRow } from '../components/status/ServiceRow';
import { IncidentCard } from '../components/status/IncidentCard';
import { SubscribeForm } from '../components/status/SubscribeForm';
import { PlatformChecks } from '../components/status/PlatformChecks';
import { IncidentHistory } from '../components/status/IncidentHistory';
import { AggregateUptimeChart } from '../components/status/AggregateUptimeChart';
import { MaintenanceBanner } from '../components/status/MaintenanceBanner';
import { MaintenanceCalendar } from '../components/status/MaintenanceCalendar';
import { ShieldCheck, RefreshCw, Activity } from 'lucide-react';

const envApi = import.meta.env.VITE_API_BASE_URL;
const resolvedApiBase = (import.meta.env.PROD || !envApi || envApi.includes('localhost:8000'))
  ? (typeof window !== 'undefined' ? `${window.location.origin}/api` : '/api')
  : envApi;

const publicApi = axios.create({
  baseURL: resolvedApiBase,
});

export default function BoomerrStatusPage() {
  const location = useLocation();
  const isAdminView = location.pathname.startsWith('/admin');

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['boomerrPlatformStatus'],
    queryFn: async () => {
      const res = await publicApi.get('/status');
      return res.data;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Dynamic SEO Structured Data & OpenGraph (Spec §9.1 & §9.2)
  React.useEffect(() => {
    if (!isAdminView) {
      document.title = 'Boomerr System Status - Real-Time Service Health & Uptime';

      const updateMeta = (name: string, content: string, isProperty = false) => {
        const attr = isProperty ? `property="${name}"` : `name="${name}"`;
        let el = document.querySelector(`meta[${attr}]`);
        if (!el) {
          el = document.createElement('meta');
          if (isProperty) el.setAttribute('property', name);
          else el.setAttribute('name', name);
          document.head.appendChild(el);
        }
        el.setAttribute('content', content);
      };

      const apiBase = resolvedApiBase;
      const ogImageUrl = `${apiBase}/status/og-image.png`;

      updateMeta('description', "Check the current operational status of Boomerr's global monitoring nodes, alerting services, and ad protection features. Live uptime data updated every 30 seconds.");
      updateMeta('og:title', 'Boomerr System Status', true);
      updateMeta('og:description', "Live operational status of Boomerr's global monitoring infrastructure.", true);
      updateMeta('og:url', typeof window !== 'undefined' ? window.location.href : '/status', true);
      updateMeta('og:type', 'website', true);
      updateMeta('og:image', ogImageUrl, true);
      updateMeta('twitter:card', 'summary_large_image');
      updateMeta('twitter:title', 'Boomerr System Status');
      updateMeta('twitter:description', "Live operational status of Boomerr's global monitoring infrastructure.");
      updateMeta('twitter:image', ogImageUrl);
    }
  }, [isAdminView]);

  const jsonLdData = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    'name': 'Boomerr System Status',
    'url': typeof window !== 'undefined' ? window.location.href : '/status',
    'description': 'Real-time operational status of Boomerr monitoring infrastructure, API servers, and regional nodes.',
    'publisher': {
      '@type': 'Organization',
      'name': 'Boomerr Uptime Monitoring',
      'url': typeof window !== 'undefined' ? window.location.origin : '/',
    },
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#030712] flex items-center justify-center">
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border border-blue-500/20 flex items-center justify-center">
              <Activity className="w-7 h-7 text-blue-400 animate-pulse" />
            </div>
            <div className="absolute inset-0 rounded-2xl bg-blue-500/10 blur-xl animate-pulse" />
          </div>
          <div className="text-center">
            <span className="text-sm font-semibold text-slate-200 block">Loading Status</span>
            <span className="text-xs text-slate-500 mt-1 block">Fetching real-time data...</span>
          </div>
        </div>
      </div>
    );
  }

  const overallStatus = data?.overall_status || 'operational';
  const nodes = data?.nodes || [];
  const services = data?.services || [];
  const platform = data?.platform || [];
  const incidents = data?.active_incidents || [];
  const maintenance = data?.maintenance || [];
  const uptime30d = data?.uptime_30d || 99.97;
  const lastCheckedAt = data?.last_checked_at;

  return (
    <div className={isAdminView ? "w-full relative pb-8" : "min-h-screen bg-[#030712] text-slate-200 font-sans selection:bg-blue-500/30 relative"}>
      {/* Premium Background Effects - only for public view */}
      {!isAdminView && (
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
          {/* Main aurora top */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1400px] h-[700px] opacity-30"
            style={{ background: 'radial-gradient(ellipse at 50% 0%, #1d4ed8 0%, #312e81 30%, transparent 65%)' }} />
          {/* Right glow */}
          <div className="absolute top-[20%] right-[-5%] w-[600px] h-[600px] opacity-[0.08] rounded-full blur-3xl"
            style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)' }} />
          {/* Bottom-left glow */}
          <div className="absolute bottom-[10%] left-[-5%] w-[500px] h-[500px] opacity-[0.06] rounded-full blur-3xl"
            style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)' }} />
          {/* Dot grid */}
          <div className="absolute inset-0 bg-[radial-gradient(#1e3a5f_1px,transparent_1px)] [background-size:30px_30px] opacity-30" />
          {/* Horizontal scan line */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />
        </div>
      )}

      <div className="relative z-10">
        <MaintenanceBanner maintenance={maintenance} />

        {/* Inject SEO Helmet / Head tags only for public */}
        {!isAdminView && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: jsonStringifySafe(jsonLdData) }}
          />
        )}

        {/* Header Bar - only for public view */}
        {!isAdminView && (
          <header className="border-b border-white/[0.06] bg-[#030712]/80 backdrop-blur-2xl sticky top-0 z-50 shadow-lg shadow-black/20">
            {/* Top accent line */}
            <div className="h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
            <div className="mx-auto flex h-14 md:h-16 items-center justify-between gap-1 px-2 sm:px-4 md:px-6 lg:px-8">
              <div className="flex items-center gap-8">
                <a href="/" className="flex items-center gap-3 group">
                  <div className="flex-shrink-0 h-10 w-10 sm:h-12 sm:w-12 flex items-center justify-center">
                    <img src={Logo} alt="Boomerr Logo" className="h-9 w-9 sm:h-11 sm:w-11 object-contain group-hover:scale-105 transition-transform" />
                  </div>
                  <div className="flex flex-col gap-0 min-w-0">
                    <span className="text-xs sm:text-sm font-bold tracking-tight text-slate-50 truncate">
                      Boomerr <span className="text-blue-400 font-medium ml-1">Status</span>
                    </span>
                    <span className="text-[10px] uppercase tracking-[0.16em] text-slate-500 truncate">
                      Public Uptime
                    </span>
                  </div>
                </a>
              </div>
              <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
                <a href="https://github.com/vistaran/boomerr#readme" target="_blank" rel="noreferrer" className="text-slate-400 hover:text-white transition-colors">Documentation</a>
                <a href="https://github.com/vistaran/boomerr" target="_blank" rel="noreferrer" className="text-slate-400 hover:text-white transition-colors">GitHub</a>
              </nav>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => refetch()}
                  disabled={isRefetching}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] rounded-lg text-slate-300 transition-all duration-200"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin text-blue-400' : ''}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
                <a
                  href="/"
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-lg transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40"
                >
                  Dashboard
                </a>
              </div>
            </div>
          </header>
        )}

        {/* Main Body */}
        <main className={isAdminView ? "space-y-8" : "max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8"}>
          {/* Banner Section */}
          <StatusBanner status={overallStatus} lastCheckedAt={lastCheckedAt} uptime30d={uptime30d} />

          {/* Global Infrastructure Map */}
          <WorldMap nodes={nodes} />

          {/* Node Cards Grid */}
          <div>
            <div className="flex items-center gap-3 mb-5">
              <div className="h-px flex-1 bg-gradient-to-r from-blue-500/20 to-transparent" />
              <h2 className="text-[11px] font-bold text-slate-500 tracking-[0.2em] uppercase">
                Global Monitoring Nodes
              </h2>
              <div className="h-px flex-1 bg-gradient-to-l from-blue-500/20 to-transparent" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {nodes.map((node: any) => (
                <NodeCard key={node.node_id} node={node} />
              ))}
            </div>
          </div>

          {/* Core Services & Platform Section */}
          <div className="rounded-2xl border border-white/[0.07] shadow-2xl overflow-hidden backdrop-blur-2xl"
            style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.85) 0%, rgba(5,11,20,0.95) 100%)' }}>
            {/* Section header with gradient accent */}
            <div className="px-6 py-5 border-b border-white/[0.06] flex items-center gap-4"
              style={{ background: 'linear-gradient(90deg, rgba(37,99,235,0.08) 0%, transparent 60%)' }}>
              <div className="w-1 h-6 rounded-full bg-gradient-to-b from-blue-400 to-indigo-600" />
              <h2 className="text-sm font-bold text-slate-200 tracking-wider uppercase">Core Monitoring Services</h2>
              <div className="ml-auto flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-slate-500 font-medium">Live</span>
              </div>
            </div>
            <div>
              {services.map((svc: any) => (
                <ServiceRow key={svc.service_id} service={svc} />
              ))}
            </div>

            <div className="px-6 py-6 border-t border-white/[0.06]"
              style={{ background: 'linear-gradient(90deg, rgba(99,102,241,0.06) 0%, transparent 60%)' }}>
              <div className="flex items-center gap-4 mb-5">
                <div className="w-1 h-6 rounded-full bg-gradient-to-b from-indigo-400 to-violet-600" />
                <h2 className="text-sm font-bold text-slate-200 tracking-wider uppercase">Platform</h2>
              </div>
              <PlatformChecks platform={platform} />
            </div>
          </div>

          {/* Uptime History Chart */}
          <AggregateUptimeChart services={services} />

          {/* Incidents Timeline - only shown when active */}
          {incidents.length > 0 && (
            <div className="rounded-2xl border border-rose-500/25 shadow-xl overflow-hidden backdrop-blur-sm"
              style={{ background: 'linear-gradient(135deg, rgba(136,19,55,0.15) 0%, rgba(15,5,10,0.95) 100%)' }}>
              <div className="px-6 py-5 border-b border-rose-500/20 flex items-center gap-3"
                style={{ background: 'linear-gradient(90deg, rgba(239,68,68,0.1) 0%, transparent 60%)' }}>
                <div className="w-1 h-6 rounded-full bg-gradient-to-b from-rose-400 to-red-600" />
                <h2 className="text-sm font-bold text-rose-400 tracking-wider uppercase flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  Active Incidents
                </h2>
                <span className="ml-auto text-xs font-mono bg-rose-500/15 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-full">
                  {incidents.length} active
                </span>
              </div>
              <div className="p-6 space-y-4">
                {incidents.map((incident: any) => (
                  <IncidentCard key={incident.id} incident={incident} />
                ))}
              </div>
            </div>
          )}

          {/* Incident History */}
          <div className="rounded-2xl border border-white/[0.07] shadow-2xl overflow-hidden backdrop-blur-2xl"
            style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.85) 0%, rgba(5,11,20,0.95) 100%)' }}>
            <div className="p-6">
              <IncidentHistory />
            </div>
          </div>

          {/* Maintenance Calendar */}
          <MaintenanceCalendar maintenance={maintenance} />

          {/* Subscribe & RSS Section */}
          <SubscribeForm />
        </main>

        {/* Footer */}
        {!isAdminView && (
          <footer className="border-t border-white/[0.05] py-8 text-center text-xs text-slate-600 mt-4">
            <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <span>Powered by <a href="/" className="font-semibold text-slate-400 hover:text-blue-400 transition-colors">Boomerr Community Edition</a></span>
              <div className="flex items-center gap-5">
                <a href="/status" className="font-semibold text-slate-300 hover:text-blue-400 transition-colors">System Status</a>
                <a href="https://github.com/vistaran/boomerr" target="_blank" rel="noreferrer" className="hover:text-slate-400 transition-colors">GitHub</a>
              </div>
            </div>
          </footer>
        )}
      </div>
    </div>
  );
}

function jsonStringifySafe(obj: any) {
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}
