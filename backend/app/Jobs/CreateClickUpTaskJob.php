<?php

namespace App\Jobs;

use App\Models\Incident;
use App\Models\NotificationChannel;
use App\Models\UserIntegration;
use App\Services\ClickUpService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class CreateClickUpTaskJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $tries = 3;

    public function __construct(
        public string $incidentId,
        public string $channelId
    ) {
        $this->queue = 'notifications';
    }

    public function handle(ClickUpService $clickUpService): void
    {
        $incident = Incident::with('domain')->find($this->incidentId);
        $channel = NotificationChannel::find($this->channelId);

        if (!$incident || !$channel) {
            return;
        }

        $tasksMap = [];
        if ($incident->clickup_task_id) {
            $decoded = json_decode($incident->clickup_task_id, true);
            if (is_array($decoded)) {
                $tasksMap = $decoded;
            } else {
                // Legacy single task ID
                $tasksMap['legacy'] = $incident->clickup_task_id;
            }
        }

        // Already has a task ID for this specific channel, skip duplicate creation
        if (isset($tasksMap[$this->channelId])) {
            Log::info("ClickUp task already exists for incident and channel", [
                'incident_id' => $incident->id,
                'channel_id' => $this->channelId
            ]);
            return;
        }

        $config = $channel->meta_json ?? [];
        $listId = $config['clickup_list_id'] ?? null;

        if (!$listId) {
            Log::error("ClickUp channel missing list ID", ['channel_id' => $channel->id]);
            return;
        }

        // Retrieve ClickUp Token for this workspace
        $integration = UserIntegration::where('provider', 'clickup')
            ->where('workspace_id', $channel->workspace_id)
            ->first();

        if (!$integration || !$integration->access_token) {
            Log::error("No ClickUp integration token found for workspace", ['workspace_id' => $channel->workspace_id]);
            return;
        }

        $domainName = $incident->domain->name ?? $incident->domain->url ?? 'Unknown Domain';
        $status = strtoupper($incident->domain->status);
        $emoji = $status === 'DOWN' ? '🚨' : '⚠️';

        $taskName = "{$emoji} {$domainName} - {$status} incident";

        $description = "Boomerr detected an incident for {$domainName}.\n\n"
            . "- Status: {$status}\n"
            . "- Detection Time: " . ($incident->started_at ? $incident->started_at->toIso8601String() : now()->toIso8601String()) . "\n"
            . "- Error Code: " . ($incident->http_status ?? 'N/A') . "\n"
            . "- Error Details: " . ($incident->exception ?? 'N/A') . "\n"
            . "- Incident URL: " . config('app.frontend_url') . "/incidents/{$incident->ulid}\n";

        $taskData = [
            'name' => $taskName,
            'description' => $description,
            'tags' => ['Boomerr', strtolower($status)],
            'priority' => $config['default_priority'] ?? 2, // 2 = High usually in ClickUp
        ];

        if (!empty($config['default_assignee'])) {
            $taskData['assignees'] = [(int) $config['default_assignee']];
        }

        $startedAt = microtime(true);

        try {
            $task = $clickUpService->createTask($integration->access_token, $listId, $taskData);

            if (isset($task['id'])) {
                $tasksMap[$this->channelId] = $task['id'];
                $incident->clickup_task_id = json_encode($tasksMap);
                $incident->save();

                // Upload screenshot if exists
                if ($incident->screenshot_url) {
                    try {
                        $fileContents = \Illuminate\Support\Facades\Storage::disk(config('filesystems.default', 'public'))->get($incident->screenshot_url);
                        if ($fileContents) {
                            $tempPath = storage_path('app/tmp_' . uniqid() . '.png');
                            file_put_contents($tempPath, $fileContents);

                            $clickUpService->uploadAttachment(
                                $integration->access_token,
                                $task['id'],
                                $tempPath,
                                "screenshot_" . \Illuminate\Support\Str::slug($domainName) . ".png"
                            );

                            @unlink($tempPath);
                        }
                    } catch (\Throwable $e) {
                        Log::warning("Failed to upload ClickUp screenshot", ['error' => $e->getMessage()]);
                    }
                }

                $durationMs = (int) round((microtime(true) - $startedAt) * 1000);
                $channel->deliveries()->create([
                    'event_name' => 'Create ClickUp Task',
                    'http_status' => 200,
                    'status' => 'success',
                    'attempt' => $this->attempts(),
                    'request_payload' => $taskData,
                    'response_body' => json_encode($task),
                    'duration_ms' => $durationMs,
                ]);
            }
        } catch (\Throwable $e) {
            $durationMs = (int) round((microtime(true) - $startedAt) * 1000);
            $channel->deliveries()->create([
                'event_name' => 'Create ClickUp Task',
                'http_status' => 500,
                'status' => 'failed',
                'attempt' => $this->attempts(),
                'request_payload' => $taskData,
                'response_body' => $e->getMessage(),
                'duration_ms' => $durationMs,
            ]);

            Log::error("CreateClickUpTaskJob failed", [
                'error' => $e->getMessage(),
                'incident_id' => $incident->id
            ]);
            throw $e;
        }
    }
}
