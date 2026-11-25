<?php

namespace App\Observers;

use App\Events\RealtimeNotificationCreated;
use App\Models\Domain;
use App\Models\User;
use Illuminate\Notifications\DatabaseNotification;

class DatabaseNotificationObserver
{
    public function creating(DatabaseNotification $notification): void
    {
        $notification->workspace_id = $this->extractWorkspaceId($notification);
    }

    private function extractWorkspaceId(DatabaseNotification $notification): ?int
    {
        $data = $notification->data ?? [];

        $workspaceId = $data['workspace_id']
            ?? ($data['domain']['workspace_id'] ?? null);

        if ($workspaceId) {
            return (int) $workspaceId;
        }

        $domainId = $data['domain']['id'] ?? null;
        if ($domainId) {
            $domainWorkspaceId = Domain::query()
                ->whereKey($domainId)
                ->value('workspace_id');

            if ($domainWorkspaceId) {
                return (int) $domainWorkspaceId;
            }
        }

        return null;
    }
    public function created(DatabaseNotification $notification): void
    {
        if ($notification->notifiable_type !== User::class) {
            return;
        }

        $payload = [
            'id' => $notification->id,
            'type' => $notification->type,
            'data' => $notification->data ?? [],
            'workspace_id' => $notification->workspace_id,
            'read_at' => $notification->read_at,
            'created_at' => optional($notification->created_at)->toISOString(),
        ];

        RealtimeNotificationCreated::dispatch((int) $notification->notifiable_id, $payload);
    }
}
