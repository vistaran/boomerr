<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class AuditLogResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'workspace_id' => $this->workspace_id,
            'event_type' => $this->event_type,
            'action' => $this->action,
            'actor' => [
                'id' => $this->actor_id,
                'name' => $this->actor_name,
                'email' => $this->actor_email,
                'role' => $this->actor_role,
                'avatar' => $this->buildAvatar($this->actor_name),
            ],
            'ip' => $this->actor_ip,
            'user_agent' => $this->actor_user_agent,
            'entity_type' => $this->entity_type,
            'entity_id' => $this->entity_id,
            'entity_name' => $this->entity_name,
            'description' => $this->description,
            'metadata' => $this->metadata,
            'changes' => $this->changes,
            'occurred_at' => optional($this->occurred_at)->toIso8601String(),
            'created_at' => optional($this->created_at)->toIso8601String(),
        ];
    }

    private function buildAvatar(?string $name): string
    {
        if (! $name) {
            return '??';
        }

        $parts = explode(' ', trim($name));

        if (count($parts) >= 2) {
            return strtoupper(mb_substr($parts[0], 0, 1) . mb_substr(end($parts), 0, 1));
        }

        return strtoupper(mb_substr($name, 0, 2));
    }
}
