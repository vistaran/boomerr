<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditLog extends Model
{
    protected $fillable = [
        'workspace_id',
        'event_type',
        'action',
        'actor_id',
        'actor_name',
        'actor_email',
        'actor_role',
        'actor_ip',
        'actor_user_agent',
        'entity_type',
        'entity_id',
        'entity_name',
        'description',
        'metadata',
        'changes',
        'occurred_at',
    ];

    protected $casts = [
        'metadata' => 'array',
        'changes' => 'array',
        'occurred_at' => 'datetime',
    ];

    // ─── Relationships ───────────────────────────────────────────────────

    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }
}
