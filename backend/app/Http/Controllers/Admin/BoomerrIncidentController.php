<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\BoomerrIncident;
use App\Models\StatusSubscription;
use App\Mail\IncidentStartedMail;
use App\Mail\IncidentResolvedMail;
use App\Services\PlatformStatusService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Mail;

class BoomerrIncidentController extends Controller
{
    public function __construct(private PlatformStatusService $statusService) {}

    public function index(Request $request): JsonResponse
    {
        $query = BoomerrIncident::orderByDesc('incident_started_at');

        if ($request->has('status')) {
            $query->where('incident_status', $request->input('status'));
        }

        $incidents = $query->paginate(20);

        $incidents->getCollection()->transform(fn ($i) => $this->statusService->formatIncident($i));

        return response()->json($incidents);
    }

    public function show(int $id): JsonResponse
    {
        $incident = BoomerrIncident::findOrFail($id);
        return response()->json($this->statusService->formatIncident($incident));
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title'             => 'required|string|max:255',
            'status'            => 'required|in:investigating,identified,monitoring,resolved',
            'impact'            => 'nullable|string',
            'cause'             => 'nullable|string',
            'affected_services' => 'nullable|array',
            'affected_services.*' => 'string',
            'started_at'        => 'required|date',
        ]);

        $incidentData = [
            'incident_title'             => $validated['title'],
            'incident_status'            => $validated['status'],
            'incident_impact'            => $validated['impact'] ?? null,
            'incident_cause'             => $validated['cause'] ?? null,
            'incident_affected_services' => $validated['affected_services'] ?? null,
            'incident_started_at'        => $validated['started_at'],
            'created_by'                 => $request->user()->id,
        ];

        $incident = BoomerrIncident::create($incidentData);

        // Notify subscribers
        $subscribers = StatusSubscription::all();
        foreach ($subscribers as $subscriber) {
            Mail::to($subscriber->email)->queue(new IncidentStartedMail($incident));
        }

        // Bust the status cache so the public page reflects immediately
        Cache::forget('boomerr_status_payload');

        return response()->json($this->statusService->formatIncident($incident), 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $incident = BoomerrIncident::findOrFail($id);

        $validated = $request->validate([
            'title'             => 'sometimes|string|max:255',
            'status'            => 'sometimes|in:investigating,identified,monitoring,resolved',
            'impact'            => 'nullable|string',
            'cause'             => 'nullable|string',
            'affected_services' => 'nullable|array',
            'affected_services.*' => 'string',
            'resolved_at'       => 'nullable|date',
        ]);

        $updateData = [];
        if (isset($validated['title'])) $updateData['incident_title'] = $validated['title'];
        if (isset($validated['status'])) $updateData['incident_status'] = $validated['status'];
        if (isset($validated['impact'])) $updateData['incident_impact'] = $validated['impact'];
        if (isset($validated['cause'])) $updateData['incident_cause'] = $validated['cause'];
        if (isset($validated['affected_services'])) $updateData['incident_affected_services'] = $validated['affected_services'];
        if (isset($validated['resolved_at'])) $updateData['incident_resolved_at'] = $validated['resolved_at'];

        // Auto-set resolved_at when status flips to resolved
        if (isset($validated['status']) && $validated['status'] === 'resolved' && !$incident->incident_resolved_at) {
            $updateData['incident_resolved_at'] = now();
        }

        $wasResolved = $incident->incident_status !== 'resolved' && (isset($updateData['incident_status']) && $updateData['incident_status'] === 'resolved');

        $incident->update($updateData);

        if ($wasResolved) {
            $subscribers = StatusSubscription::all();
            foreach ($subscribers as $subscriber) {
                Mail::to($subscriber->email)->queue(new IncidentResolvedMail($incident));
            }
        }

        Cache::forget('boomerr_status_payload');

        return response()->json($this->statusService->formatIncident($incident->fresh()));
    }

    public function destroy(int $id): JsonResponse
    {
        BoomerrIncident::findOrFail($id)->delete();
        Cache::forget('boomerr_status_payload');
        return response()->json(['message' => 'Incident deleted.']);
    }
}
