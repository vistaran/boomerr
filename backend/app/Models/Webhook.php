<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Webhook extends Model
{
    protected $fillable = [
        'workspace_id',
        'name',
        'url',
        'secret',
        'enabled',
        'timeout',
        'retry_enabled',
        'failure_count',
    ];

    protected $casts = [
        'enabled' => 'boolean',
        'retry_enabled' => 'boolean',
        'timeout' => 'integer',
        'failure_count' => 'integer',
    ];

    public function workspace()
    {
        return $this->belongsTo(Workspace::class);
    }

    public function events()
    {
        return $this->hasMany(WebhookEvent::class);
    }

    public function deliveries()
    {
        return $this->hasMany(WebhookDelivery::class);
    }
}
