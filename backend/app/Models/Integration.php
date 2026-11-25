<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Integration extends Model
{
    use HasFactory;

    protected $fillable = [
        'key',       // discord, slack, sms
        'name',      // Discord, Slack
        'is_active', // platform-wide toggle
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    /* ================= Relations ================= */

    public function workspaces()
    {
        return $this->belongsToMany(
            Workspace::class,
            'workspace_integrations'
        )->withPivot('enabled')
            ->withTimestamps();
    }

    public function domains()
    {
        return $this->belongsToMany(
            Domain::class,
            'domain_integrations'
        )->withPivot('enabled')
            ->withTimestamps();
    }

    public function notificationChannels()
    {
        return $this->hasMany(NotificationChannel::class);
    }

    public function workspaceIntegrations()
    {
        return $this->hasMany(WorkspaceIntegration::class);
    }

    public function domainIntegrations()
    {
        return $this->hasMany(DomainIntegration::class);
    }
}
