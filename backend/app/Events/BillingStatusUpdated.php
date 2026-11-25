<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class BillingStatusUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public int $workspaceId,
        public int $subscriptionId,
        public string $status,
        public ?string $planCode,
        public ?string $eventType,
    ) {}

    public function broadcastOn(): Channel
    {
        return new PrivateChannel('company.' . $this->workspaceId);
    }

    public function broadcastAs(): string
    {
        return 'BillingStatusUpdated';
    }

    public function broadcastWith(): array
    {
        return [
            'workspace_id' => $this->workspaceId,
            'subscription_id' => $this->subscriptionId,
            'status' => $this->status,
            'plan_code' => $this->planCode,
            'event_type' => $this->eventType,
            'updated_at' => now()->toIso8601String(),
        ];
    }
}
