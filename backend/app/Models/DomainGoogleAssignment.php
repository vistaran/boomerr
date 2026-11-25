<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class DomainGoogleAssignment extends Model
{
    use HasFactory;

    protected $table = 'domain_google_assignments';

    protected static function boot()
    {
        parent::boot();
        static::creating(function ($model) {
            if (empty($model->ulid)) {
                $model->ulid = (string) Str::ulid();
            }
        });
    }

    public function uniqueIds(): array
    {
        return ['ulid'];
    }

    protected $fillable = [
        'ulid',
        'domain_id',
        'user_integration_id',
        'google_campaign_id',
        'google_account_id',
        'campaign_name',
        'campaign_status',
        'is_system_paused',
        'system_paused_at',
        'original_status',
    ];

    protected $casts = [
        'is_system_paused' => 'boolean',
        'system_paused_at' => 'datetime',
    ];

    public function domain(): BelongsTo
    {
        return $this->belongsTo(Domain::class);
    }

    public function userIntegration(): BelongsTo
    {
        return $this->belongsTo(UserIntegration::class);
    }

    /**
     * Check if the campaign was paused by the system (not user).
     */
    public function wasSystemPaused(): bool
    {
        return $this->is_system_paused && $this->system_paused_at !== null;
    }

    /**
     * Mark as system-paused and record the original status.
     */
    public function markAsSystemPaused(string $originalStatus): void
    {
        $this->update([
            'is_system_paused' => true,
            'system_paused_at' => now(),
            'original_status' => $originalStatus,
        ]);
    }

    /**
     * Clear system-pause tracking after resume.
     */
    public function clearSystemPause(): void
    {
        $this->update([
            'is_system_paused' => false,
            'system_paused_at' => null,
            'original_status' => null,
        ]);
    }

    /**
     * Scope to get assignments for a domain.
     */
    public function scopeForDomain($query, $domainId)
    {
        return $query->where('domain_id', $domainId);
    }

    /**
     * Scope to get assignments that are system-paused.
     */
    public function scopeSystemPaused($query)
    {
        return $query->where('is_system_paused', true);
    }

    /**
     * Scope to get assignments for a specific integration.
     */
    public function scopeForIntegration($query, int $integrationId)
    {
        return $query->where('user_integration_id', $integrationId);
    }
}
