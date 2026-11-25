<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use App\Models\Domain;

class DomainDeleted implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public Domain $domain)
    {
    }

    public function broadcastOn(): Channel
    {
        return new PrivateChannel('company.' . $this->domain->workspace_id);
    }

    public function broadcastAs(): string
    {
        return 'DomainDeleted';
    }

    public function broadcastWith(): array
    {
        return [
            'domain_id' => $this->domain->id,
        ];
    }
}
