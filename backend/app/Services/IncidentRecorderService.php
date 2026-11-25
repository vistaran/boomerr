<?php

namespace App\Services;

use App\Http\Controllers\SystemLogController;
use App\Models\Domain;
use App\Models\DomainStatusEvent;
use App\Models\Incident;
use App\Models\IncidentAIChat;
use App\Models\SystemLog;
use App\Models\User;
use App\Services\AI\IncidentAIService;
use Aws\S3\S3Client;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Spatie\Browsershot\Browsershot;
use Illuminate\Support\Str;
use Illuminate\Database\Eloquent\Builder;

class IncidentRecorderService
{
    /**
     * Record a new incident for a domain and dispatch background enrichment.
     */
    public function recordIncident(Domain $domain, array $extraHeaders = []): Incident
    {
        // Categorize response headers (ONCE)
        $responseHeaders = $extraHeaders['response_headers'] ?? [];

        $extraHeaders['categorized_headers'] = $this->categorizeResponseHeaders(
            $responseHeaders
        );

        $incidentData = [
            'domain_id' => $domain->id,
            'workspace_id' => $domain->workspace_id,
            'status' => 'ongoing',
            'started_at' => now(),
            'screenshot_url' => '',
            'ai_analysis' => $this->getAiAnalysis($domain),

            // Queryable fields
            'http_status' => $extraHeaders['http_status'] ?? null,
            'duration_ms' => $extraHeaders['duration_ms'] ?? null,
            'exception' => $extraHeaders['exception'] ?? null,

            // Everything else
            'extra_headers' => $extraHeaders,
        ];

        $incident = Incident::create($incidentData);

        // Asynchronously process screenshot capture and AI analysis without blocking uptime checks
        \App\Jobs\ProcessIncidentEnrichmentJob::dispatch($incident->id);

        return $incident;
    }

    /**
     * Capture a screenshot of the domain and upload to storage.
     */
    public function captureScreenshotToS3(string $url): ?string
    {
        $tempPath = storage_path('app/tmp_' . Str::uuid() . '.png');
        try {
            Browsershot::url($url)
                ->windowSize(1280, 800)
                ->timeout(60000)
                ->ignoreHttpsErrors()
                ->setOption('args', [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                ])
                ->userAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36')
                ->save($tempPath);

            if (!file_exists($tempPath) || filesize($tempPath) === 0) {
                Log::warning('Browsershot did not generate a screenshot file', ['url' => $url]);
                return null;
            }

            $filename = 'boomerr/incidents/screenshots/' . Str::uuid() . '.png';
            $diskName = config('filesystems.default', 'public');
            $disk = Storage::disk($diskName);

            $stream = fopen($tempPath, 'r');
            $saved = $disk->put($filename, $stream, 'public');
            if (is_resource($stream)) {
                fclose($stream);
            }

            if ($saved) {
                return $filename;
            }

            Log::warning('Failed to save screenshot to storage disk', ['url' => $url, 'disk' => $diskName]);
            return null;
        } catch (\Throwable $e) {
            // Screenshot failures are logged as warnings and do not fail the incident job
            Log::warning('Failed to capture screenshot with Browsershot: ' . $e->getMessage(), ['url' => $url]);
            return null;
        } finally {
            if (file_exists($tempPath)) {
                @unlink($tempPath);
            }
        }
    }

    /**
     * Get AI analysis for the incident (stub for now).
     */
    protected function getAiAnalysis(Domain $domain): ?string
    {
        // TODO: Integrate Boomerr Agent API here
        // For now, return a placeholder
        if ($domain->status === 'down') {
            return 'Possible reasons: DNS issues, server downtime, SSL errors, or network problems.';
        }
        return null;
    }

    protected function categorizeResponseHeaders(array $responseHeaders): array
    {
        $important = [
            'content-type',
            'content-length',
            'cache-control',
            'set-cookie',
            'authorization',
            'strict-transport-security',
            'x-frame-options',
            'x-content-type-options',
            'x-xss-protection',
            'location',
            'server',
            'date',
            'retry-after',
        ];

        $notImportant = [
            'etag',
            'expires',
            'pragma',
            'vary',
            'connection',
            'keep-alive',
            'accept-ranges',
            'transfer-encoding',
            'cf-cache-status',
            'alt-svc',
        ];

        $categorized = [
            'important' => [],
            'not_important' => [],
            'extra' => [],
        ];

        foreach ($responseHeaders as $key => $value) {
            $normalizedKey = strtolower(trim($key));

            if (in_array($normalizedKey, $important, true)) {
                $categorized['important'][$key] = $value;
            } elseif (in_array($normalizedKey, $notImportant, true)) {
                $categorized['not_important'][$key] = $value;
            } else {
                $categorized['extra'][$key] = $value;
            }
        }

        return $categorized;
    }


    public function buildBaseQuery(User $user, $request)
    {
        $workspaceId = $user->currentWorkspaceId();
        $userRole = $user->roleInWorkspace($workspaceId) ?? 'member';

        $latestResponseSubquery = DomainStatusEvent::select('response_time_ms')
            ->whereColumn('domain_status_events.domain_id', 'system_logs.domain_id')
            ->orderByDesc('domain_status_events.created_at')
            ->limit(1);

        $query = SystemLog::query()
            ->select('system_logs.*')
            ->selectSub($latestResponseSubquery, 'latest_response_time_ms')
            ->where('workspace_id', $workspaceId)
            ->parents()
            ->whereNotIn('event_type', SystemLogController::EXCLUDED_EVENT_TYPES)
            ->where(function (Builder $builder) {
                $builder->whereNull('integration_id')
                    ->orWhereHas('integration', fn($q) => $q->where('is_launched', true));
            });

        // reuse filters
        app(SystemLogController::class)->applyRoleBasedFiltering(
            $query,
            $user,
            $userRole,
            $workspaceId
        );

        return [$query, $userRole];
    }
}
