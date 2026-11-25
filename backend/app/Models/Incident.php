<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Incident extends Model
{
    use HasFactory, HasUlids;

    public function uniqueIds(): array
    {
        return ['ulid'];
    }

    protected $fillable = [
        'ulid',
        'domain_id',
        'workspace_id',
        'incident_ai_chat_id',
        'status',
        'started_at',
        'resolved_at',
        'screenshot_url',
        'ai_analysis',
        'extra_headers',
        // For future extensibility
        'http_status',
        'response_headers',
        'response_body',
        'duration_ms',
        'exception',
        'clickup_task_id',
    ];

    protected $casts = [
        'started_at' => 'datetime',
        'resolved_at' => 'datetime',
        'extra_headers' => 'array',
        'response_headers' => 'array',
    ];

    public function domain()
    {
        return $this->belongsTo(Domain::class);
    }

    public function aiMessages()
    {
        return $this->hasMany(IncidentAIChat::class);
    }

    public function systemLogs()
    {
        return $this->hasMany(SystemLog::class);
    }
}
