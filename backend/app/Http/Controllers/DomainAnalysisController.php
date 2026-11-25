<?php

namespace App\Http\Controllers;

use App\Http\Resources\DomainAiAnalysisResource;
use App\Models\Domain;
use App\Models\DomainAiAnalysis;
use App\Models\User;
use App\Services\AI\DomainAnalysisService;
use App\Services\PlanLimitService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class DomainAnalysisController extends Controller
{
    public function __construct(private readonly DomainAnalysisService $aiService)
    {
        try {
            // Constructor logic
        } catch (\Throwable $e) {
            // Handle exception silently or log if needed
        }
    }

    public function show(Request $request, $domain_id): JsonResponse
    {
        try {
            $domain = Domain::where('ulid', $domain_id)->firstOrFail();
            $this->ensureDomainAccess($request->user(), $domain);

            $workspace = $request->user()?->currentWorkspace();
            if (! $workspace || ! PlanLimitService::hasFeature($workspace, 'ai_analysis')) {
                return response()->json([
                    'message' => 'Boomerr Agent Analysis is not available on your current plan. Please upgrade to Starter or above.',
                ]);
            }

            $analysis = $domain->aiAnalysis;

            if (! $analysis) {
                try {
                    $analysis = $this->generateAnalysis($domain);
                } catch (\Throwable $e) {
                    Log::warning($e->getMessage());
                    return response()->json([
                        'message' => 'Analysis is currently unavailable for this domain. Please try again later.',
                        'data' => null,
                    ], 422);
                }
            }

            return response()->json([
                'data' => DomainAiAnalysisResource::make($analysis),
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'message' => 'Failed to load domain analysis. Please try again later.',
            ], 500);
        }
    }

    public function reanalyze(Request $request, $domain): JsonResponse
    {
        try {
            $domain = Domain::where('ulid', $domain)->firstOrFail();

            $this->ensureDomainAccess($request->user(), $domain);

            $workspace = $request->user()?->currentWorkspace();
            if (! $workspace || ! PlanLimitService::hasFeature($workspace, 'ai_analysis')) {
                return response()->json([
                    'message' => 'Boomerr Agent Analysis is not available on your current plan. Please upgrade to Starter or above.',
                ], 403);
            }

            $analysis = $this->generateAnalysis($domain);

            return response()->json([
                'message' => 'Domain analysis updated successfully.',
                'data' => DomainAiAnalysisResource::make($analysis),
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'message' => 'Unable to re-analyze domain at this time. Please try again later.',
            ], 422);
        }
    }

    protected function ensureDomainAccess(?User $user, Domain $domain): void
    {
        if (! $user || (int) $user->currentWorkspaceId() !== (int) $domain->workspace_id) {
            abort(404);
        }
    }

    protected function generateAnalysis(Domain $domain): DomainAiAnalysis
    {
        $payload = $this->aiService->analyze($domain);

        return tap(DomainAiAnalysis::updateOrCreate(
            ['domain_id' => $domain->id],
            [
                'scores' => $payload['scores'],
                'suggestions' => $payload['suggestions'],
            ]
        ))->fresh();
    }
}
