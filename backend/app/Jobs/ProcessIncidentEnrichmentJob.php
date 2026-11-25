<?php

namespace App\Jobs;

use App\Models\Incident;
use App\Models\IncidentAIChat;
use App\Services\AI\IncidentAIService;
use App\Services\IncidentRecorderService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Throwable;

class ProcessIncidentEnrichmentJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 180;
    public int $tries = 2;

    public function __construct(public int $incidentId)
    {
        $this->onQueue('default');
    }

    public function handle(IncidentRecorderService $incidentRecorder, IncidentAIService $aiService): void
    {
        $incident = Incident::with('domain')->find($this->incidentId);

        if (!$incident || !$incident->domain) {
            return;
        }

        // 1. Capture and upload screenshot if not already present
        if (empty($incident->screenshot_url)) {
            try {
                $screenshotKey = $incidentRecorder->captureScreenshotToS3($incident->domain->url);
                if ($screenshotKey) {
                    $incident->screenshot_url = $screenshotKey;
                    $incident->save();
                    Log::info("Incident #{$incident->id} screenshot captured: {$screenshotKey}");
                }
            } catch (Throwable $e) {
                Log::warning("Failed to capture screenshot for incident #{$incident->id}", [
                    'domain_id' => $incident->domain_id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        // 2. Generate AI summary and analysis if not already present
        if (empty($incident->ai_summary)) {
            try {
                $analysis = $aiService->analyzeIncident($incident);
                if (!empty($analysis)) {
                    $incident->ai_summary = $analysis;
                    $incident->ai_summary_generated_at = now();
                    $incident->save();

                    IncidentAIChat::create([
                        'incident_id' => $incident->id,
                        'role' => 'ai',
                        'message' => $analysis,
                    ]);
                    Log::info("Incident #{$incident->id} AI analysis generated successfully");
                }
            } catch (Throwable $e) {
                Log::warning("Failed to generate AI analysis for incident #{$incident->id}", [
                    'domain_id' => $incident->domain_id,
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }
}
