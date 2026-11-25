import { IncidentSystemLogs } from "../components/incidents/incident-system-logs";
import React, { lazy, Suspense } from 'react';
import { Info, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { useParams } from 'react-router-dom';
import ErrorMessage from '../components/common/error-message';
import {
  useIncident,
} from '../hooks/use-incidents';
import type { User } from "../types/user";
import { usePlanLimits } from '../hooks/use-plan-limits';
import { PlanLimitGuard } from '../components/common/plan-limit-guard';
import { IncidentDetailsTitle } from "../components/incidents/incident-details-title";
import { IncidentHeaders } from "../components/incidents/incident-header";
import { IncidentScreenshot } from "../components/incidents/incident-screenshot";

const IncidentChat = lazy(() => import("../components/incidents/incident-chat/incident-chat").then(m => ({ default: m.IncidentChat })));

type IncidentDetailsPageProps = {
  currentUser: User;
};

const IncidentDetailsPage: React.FC<IncidentDetailsPageProps> = ({ currentUser }) => {
  const { id } = useParams<{ id: string }>();
  const incidentId = id!;
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const { hasFeature, isPlanInfoLoading } = usePlanLimits();
  const isIncidentAllowed = hasFeature('incident_reporting');

  const { data: incidentDetails, isLoading, error } = useIncident(
    incidentId, 
    { timezone: userTimezone },
    { enabled: isIncidentAllowed }
  );

  const incident = incidentDetails?.incident;

  /* -------------------- PLAN CHECK -------------------- */
  if (!isPlanInfoLoading && !isIncidentAllowed) {
    return (
      <section className="px-2 pb-10 pt-2 sm:px-4 sm:pt-4">
        <PlanLimitGuard allowed={false} featureLabel="Incident Reporting" variant="overlay">
          <div className="min-h-[50vh] rounded-xl border border-slate-800 bg-slate-900/60 p-8">
            <div className="space-y-4">
              <div className="h-8 w-48 rounded bg-slate-700/60" />
              <div className="h-4 w-full rounded bg-slate-700/60" />
              <div className="h-4 w-3/4 rounded bg-slate-700/60" />
            </div>
          </div>
        </PlanLimitGuard>
      </section>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-slate-400">
        Loading incident…
      </div>
    );
  }

  if (error || !incident) {
    return <ErrorMessage message="Error loading incident." />;
  }


  // Status styles helper
  const STATUS_STYLES: Record<string, { icon: React.ReactNode; color: string }> = {
    success: { icon: <CheckCircle2 size={12} />, color: 'text-emerald-400' },
    failure: { icon: <XCircle size={12} />, color: 'text-rose-400' },
    info: { icon: <AlertCircle size={12} />, color: 'text-sky-400' },
  };

  return (
    <div className="min-h-screen bg-slate-950 px-2 pb-10 pt-2 sm:px-4 sm:pt-4">
      <div className="mx-auto max-w-[1800px] px-4 py-6 sm:px-6 lg:px-8">
        {/* ================= HEADER ================= */}
        <IncidentDetailsTitle
          incident={incident}
          incidentId={incidentId}
          currentUser={currentUser}
        />

        {/* ================= MAIN CONTENT ================= */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_500px] gap-6">
          {/* ===== LEFT: TECHNICAL DATA ===== */}
          <div className="space-y-6">
            {/* Response headers */}
            <IncidentHeaders incident={incident} />

            {/* Screenshot */}
            <IncidentScreenshot incidentId={incidentId} />

            {/* ===== SYSTEM LOGS SECTION ===== */}
            {incidentDetails.system_logs && incidentDetails.system_logs.length > 0 && (
              <div className="rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-900/50 p-5 backdrop-blur-sm">
                <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
                  <Info className="w-5 h-5 text-sky-400" />
                  Related System Log
                </h2>
                <IncidentSystemLogs logs={incidentDetails.system_logs} incidentUlid={incident.ulid} STATUS_STYLES={STATUS_STYLES} />
              </div>
            )}
          </div>

          {/* ===== RIGHT: AI CHAT (STICKY ON DESKTOP) ===== */}
          <div className="xl:sticky xl:top-6 xl:self-start">
            <Suspense fallback={
              <div className="h-[450px] rounded-xl border border-slate-800 bg-slate-900/40 p-4 animate-pulse flex items-center justify-center text-slate-500 text-xs">
                Loading AI Assistant...
              </div>
            }>
              <IncidentChat incident={incident} incidentId={incidentId} />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  )
};



export default IncidentDetailsPage;
