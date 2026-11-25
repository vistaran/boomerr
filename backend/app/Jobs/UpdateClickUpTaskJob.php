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

class UpdateClickUpTaskJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $tries = 3;

    public function __construct(
        public string $incidentId,
        public string $channelId
    ) {
        //
    }

    public function handle(ClickUpService $clickUpService): void
    {
        $incident = Incident::with('domain')->find($this->incidentId);
        $channel = NotificationChannel::find($this->channelId);

        if (!$incident || !$channel) {
            return;
        }

        $incident->refresh();

        $tasksMap = [];
        if ($incident->clickup_task_id) {
            $decoded = json_decode($incident->clickup_task_id, true);
            if (is_array($decoded)) {
                $tasksMap = $decoded;
            } else {
                $tasksMap['legacy'] = $incident->clickup_task_id;
            }
        }

        $taskId = $tasksMap[$this->channelId]
            ?? $tasksMap[(string) $this->channelId]
            ?? ($tasksMap['legacy'] ?? null);

        if (!$taskId) {
            if ($this->attempts() < 3) {
                // Task creation may still be running in the queue, retry after 5 seconds
                $this->release(5);
                return;
            }
            Log::warning("Cannot update ClickUp task - no task ID associated with incident for this channel", [
                'incident_id' => $incident->id,
                'channel_id' => $this->channelId,
            ]);
            return;
        }

        $integration = UserIntegration::where('provider', 'clickup')
            ->where('workspace_id', $channel->workspace_id)
            ->first();

        if (!$integration || !$integration->access_token) {
            Log::error("No ClickUp integration token found for workspace", ['workspace_id' => $channel->workspace_id]);
            return;
        }

        $domainName = $incident->domain->name ?? $incident->domain->url ?? 'Unknown Domain';
        $status = strtoupper($incident->status);
        
        $duration = $incident->duration_ms ? round($incident->duration_ms / 60000, 2) . ' minutes' : 'Unknown';
        
        $comment = "✅ Incident Resolved: {$domainName}\n\n"
            . "- Recovery Time: " . ($incident->resolved_at ? $incident->resolved_at->toIso8601String() : now()->toIso8601String()) . "\n"
            . "- Total Downtime: {$duration}\n"
            . "- Final Status: {$status}\n";

        $startedAt = microtime(true);
        $payloads = [];

        try {
            // Add recovery comment
            try {
                $payloads['comment'] = ['comment_text' => $comment];
                $clickUpService->addComment($integration->access_token, $taskId, $comment);
            } catch (\Throwable $ce) {
                Log::warning("Could not add comment to ClickUp task", [
                    'task_id' => $taskId,
                    'error' => $ce->getMessage(),
                ]);
            }

            // Determine closed status name for this list
            $listId = $channel->meta_json['clickup_list_id'] ?? null;
            $closedStatus = null;
            if ($listId) {
                try {
                    $listData = $clickUpService->getList($integration->access_token, (string) $listId);
                    if (!empty($listData['statuses']) && is_array($listData['statuses'])) {
                        foreach ($listData['statuses'] as $stObj) {
                            if (isset($stObj['type']) && strtolower($stObj['type']) === 'closed') {
                                $closedStatus = $stObj['status'];
                                break;
                            }
                        }
                    }
                } catch (\Throwable $le) {
                    Log::warning("Could not fetch ClickUp list statuses", ['error' => $le->getMessage()]);
                }
            }

            $candidateStatuses = [];
            if ($closedStatus) {
                $candidateStatuses[] = $closedStatus;
            }
            $candidateStatuses = array_values(array_unique(array_merge($candidateStatuses, [
                'closed',
                'complete',
                'Closed',
                'Complete',
                'Done',
                'done',
                'resolved',
                'Resolved',
            ])));

            $task = null;
            $statusUpdated = false;

            foreach ($candidateStatuses as $candidate) {
                try {
                    $payloads['update'] = [
                        'name' => "✅ [RESOLVED] {$domainName} was DOWN",
                        'status' => $candidate,
                        'description' => $comment,
                    ];
                    $task = $clickUpService->updateTask($integration->access_token, $taskId, $payloads['update']);
                    $statusUpdated = true;
                    break;
                } catch (\Throwable $ue) {
                    // Try next candidate status
                }
            }

            if (!$statusUpdated) {
                $payloads['update'] = [
                    'name' => "✅ [RESOLVED] {$domainName} was DOWN",
                    'description' => $comment,
                ];
                $task = $clickUpService->updateTask($integration->access_token, $taskId, $payloads['update']);
            }
            
            $durationMs = (int) round((microtime(true) - $startedAt) * 1000);
            $channel->deliveries()->create([
                'event_name' => 'Update ClickUp Task',
                'http_status' => 200,
                'status' => 'success',
                'attempt' => $this->attempts(),
                'request_payload' => $payloads,
                'response_body' => json_encode($task ?? ['success' => true]),
                'duration_ms' => $durationMs,
            ]);
            
        } catch (\Throwable $e) {
            $durationMs = (int) round((microtime(true) - $startedAt) * 1000);
            $channel->deliveries()->create([
                'event_name' => 'Update ClickUp Task',
                'http_status' => 500,
                'status' => 'failed',
                'attempt' => $this->attempts(),
                'request_payload' => $payloads,
                'response_body' => $e->getMessage(),
                'duration_ms' => $durationMs,
            ]);

            Log::error("UpdateClickUpTaskJob failed", [
                'error' => $e->getMessage(),
                'incident_id' => $incident->id
            ]);
            throw $e;
        }
    }
}
