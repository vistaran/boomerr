<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BoomerrIncident extends Model
{
    protected $table = 'boomerr_incidents';

    protected $fillable = [
        'incident_id',
        'incident_title',
        'incident_status',
        'incident_impact',
        'incident_cause',
        'incident_affected_services',
        'incident_started_at',
        'incident_resolved_at',
        'created_by',
    ];

    protected $casts = [
        'incident_affected_services' => 'array',
        'incident_started_at'        => 'datetime',
        'incident_resolved_at'       => 'datetime',
    ];

    protected static function booted()
    {
        static::creating(function ($incident) {
            if (empty($incident->incident_id)) {
                $incident->incident_id = 'INC-' . date('Ymd') . '-' . str_pad(rand(1, 9999), 4, '0', STR_PAD_LEFT);
            }
        });
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(Admin::class, 'created_by');
    }

    /**
     * Compute duration string (e.g. "12 min" or "2h 5min").
     */
    public function getDurationAttribute(): ?string
    {
        if (!$this->incident_resolved_at) {
            return null;
        }
        $minutes = (int) $this->incident_started_at->diffInMinutes($this->incident_resolved_at);
        if ($minutes < 60) {
            return $minutes . ' min';
        }
        $hours = intdiv($minutes, 60);
        $rem   = $minutes % 60;
        return $rem > 0 ? "{$hours}h {$rem}min" : "{$hours}h";
    }

    /**
     * Scope to active (unresolved) incidents.
     */
    public function scopeActive($query)
    {
        return $query->whereNull('incident_resolved_at');
    }
}
