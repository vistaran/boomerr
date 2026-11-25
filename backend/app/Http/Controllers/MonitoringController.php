<?php

namespace App\Http\Controllers;

use App\Models\Domain;
use App\Services\MonitoringService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class MonitoringController extends Controller
{
    protected MonitoringService $monitoringService;

    public function __construct(MonitoringService $monitoringService)
    {
        $this->monitoringService = $monitoringService;
    }

    /**
     * Return active domains to be checked by remote edge probes.
     */
    public function targets(Request $request)
    {
        $domains = Domain::where('is_active', true)
            ->whereNull('paused_reason')
            ->select(['id', 'ulid', 'name', 'url', 'check_interval', 'status'])
            ->get();

        return response()->json([
            'success' => true,
            'count' => $domains->count(),
            'data' => $domains,
        ]);
    }

    /**
     * Receive monitoring results from Lambda.
     */
    public function results(Request $request)
    {
        Log::info("Received API monitoring payload", ['payload' => $request->all()]);
        try {
            // Lambda might send aws_region based on process.env.AWS_REGION
            if ($request->has('aws_region') && !$request->has('region')) {
                $request->merge(['region' => $request->input('aws_region')]);
            }

            $validated = $request->validate([
                'website_id' => 'required|integer',
                'status' => 'nullable|integer',
                'response_time' => 'nullable|integer',
                'checked_at' => 'required|date',
                'region' => 'nullable|string',
                'aws_region' => 'nullable|string',
                'location' => 'nullable|string',
                'source' => 'nullable|string',
                'error' => 'nullable|string',
            ]);
        } catch (ValidationException $e) {
            Log::error('Validation error for Lambda result', ['errors' => $e->errors(), 'payload' => $request->all()]);
            return response()->json([
                'success' => false,
                'message' => 'Validation Error',
                'errors' => $e->errors()
            ], 422);
        }

        try {
            $this->monitoringService->storeResult($validated);
            return response()->json(['success' => true]);

        } catch (\Exception $e) {
            Log::error('Failed to store monitoring result', [
                'error' => $e->getMessage(),
                'payload' => $request->all()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Internal Server Error'
            ], 500);
        }
    }

    /**
     * Receive batch monitoring results from Lambda.
     */
    public function batchResults(Request $request)
    {
        Log::info("Received API batch monitoring payload");
        
        try {
            // Lambda might send aws_region based on process.env.AWS_REGION
            if ($request->has('aws_region') && !$request->has('region')) {
                $request->merge(['region' => $request->input('aws_region')]);
            }

            $validated = $request->validate([
                'region' => 'nullable|string',
                'aws_region' => 'nullable|string',
                'location' => 'nullable|string',
                'source' => 'nullable|string',
                'results' => 'required|array',
                'results.*.website_id' => 'required|integer',
                'results.*.status' => 'nullable|integer',
                'results.*.response_time' => 'nullable|integer',
                'results.*.checked_at' => 'required|date',
                'results.*.error' => 'nullable|string',
            ]);
        } catch (ValidationException $e) {
            Log::error('Validation error for Lambda batch results', [
                'errors' => $e->errors(),
                'payload' => $request->all()
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Validation Error',
                'errors' => $e->errors()
            ], 422);
        }

        try {
            $this->monitoringService->storeBatchResults($validated);
            return response()->json(['success' => true]);

        } catch (\Exception $e) {
            Log::error('Failed to store batch monitoring results', [
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Internal Server Error'
            ], 500);
        }
    }

    /**
     * Standalone incoming heartbeat endpoint called directly by Lambda functions every 30 seconds.
     * This is the single authoritative source for node heartbeat telemetry.
     */
    public function heartbeat(Request $request)
    {
        try {
            if ($request->has('aws_region') && !$request->has('region')) {
                $request->merge(['region' => $request->input('aws_region')]);
            }

            $validated = $request->validate([
                'region'           => 'required|string',
                'aws_region'       => 'nullable|string',
                'latency_ms'       => 'nullable|integer',
                'checks_run_24h'   => 'nullable|integer',
                'success_rate_24h' => 'nullable|numeric',
            ]);

            $hb = \App\Models\NodeHeartbeat::recordFromTelemetry(
                $validated['region'],
                $validated['latency_ms'] ?? null,
                $validated['checks_run_24h'] ?? null,
                $validated['success_rate_24h'] ?? null
            );

            return response()->json([
                'success' => true,
                'node_id' => $hb->node_id,
                'recorded_at' => $hb->created_at->toIso8601String()
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to record node heartbeat', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }
}
