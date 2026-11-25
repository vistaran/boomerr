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


class DomainStatusUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels, SerializesDomain;

    public function __construct(
        public Domain $domain,
        public bool $statusChanged = false,
        public ?int $parentLogId = null
    ) {
    }

    public function broadcastOn(): Channel
    {
        // company.X => private-company.X
        return new PrivateChannel('company.' . $this->domain->workspace_id);
    }

    public function broadcastAs(): string
    {
        // JS will listen for "DomainStatusUpdated"
        return 'DomainStatusUpdated';
    }

    public function broadcastWith(): array
    {
        return [
            'domain' => $this->serializeDomain($this->domain),
        ];
    }
}
