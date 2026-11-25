<?php

namespace App\Events;

use App\Events\Concerns\SerializesDomain;
use App\Models\Domain;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class DomainUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels, SerializesDomain;

    public function __construct(public Domain $domain)
    {
    }

    public function broadcastOn(): Channel
    {
        return new PrivateChannel('company.' . $this->domain->workspace_id);
    }

    public function broadcastAs(): string
    {
        return 'DomainUpdated';
    }

    public function broadcastWith(): array
    {
        return [
            'domain' => $this->serializeDomain($this->domain),
        ];
    }
}
