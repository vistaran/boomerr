import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import React from 'react';

type IncidentResponse = {
    ai_analysis?: string;
    [key: string]: unknown;
};

export function AskBoomerrAISection() {
    const { incidentId } = useParams<{ incidentId: string }>();
    const { data, isLoading, error } = useQuery<IncidentResponse>({
        queryKey: ['incident', incidentId],
        queryFn: async () => {
            const res = await fetch(`/api/incidents/${incidentId}`);
            if (!res.ok) throw new Error('Failed to fetch incident details');
            return res.json();
        },
        enabled: !!incidentId,
        meta: { suppressErrorToast: true },
    });

    if (isLoading) return <div>Loading AI analysis...</div>;
    if (error) return <div>Error loading AI analysis.</div>;

    return (
        <section className="ask-boomerr-ai-section">
            <h2>Ask Boomerr Agent</h2>
            <div className="ai-analysis-box">
                {data?.ai_analysis || 'No AI analysis available for this incident.'}
            </div>
        </section>
    );
}
