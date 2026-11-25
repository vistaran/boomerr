<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TelegramConnectionToken extends Model
{
    protected $fillable = [
        'token',
        'workspace_id',
        'domain_id',
        'integration_id',
        'user_id',
        'events',
        'used_at',
        'expires_at',
    ];

    protected $casts = [
        'events' => 'array',
        'used_at' => 'datetime',
        'expires_at' => 'datetime',
    ];

    public function workspace()
    {
        return $this->belongsTo(Workspace::class);
    }

    public function domain()
    {
        return $this->belongsTo(Domain::class);
    }

    public function integration()
    {
        return $this->belongsTo(Integration::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function isExpired(): bool
    {
        return $this->expires_at->isPast();
    }

    public function isUsed(): bool
    {
        return $this->used_at !== null;
    }

    public function isValid(): bool
    {
        return !$this->isExpired() && !$this->isUsed();
    }
}
