<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\Workspace as Company;
use App\Models\DomainIntegration;
use App\Models\DomainFacebookAssignment;
use App\Models\DomainGoogleAssignment;
use App\Models\NotificationChannel;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Domain extends Model
{
    use HasUlids, HasFactory;

    public function uniqueIds(): array
    {
        return ['ulid'];
    }

    protected $fillable = [
        'workspace_id',
        'ulid',
        'name',
        'url',
        'label',
        'environment',
        'is_active',
        'paused_reason',
        'status',
        'last_response_time_ms',
        'last_checked_at',
        'ssl_issuer',
        'ssl_valid_from',
        'ssl_valid_to',
        'ssl_days_remaining',
        'ssl_last_checked_at',
        'ssl_expiry_notified_days',
        'domain_expires_at',
        'domain_days_remaining',
        'domain_last_checked_at',
        'failure_count',
        'last_sms_at',
        'last_whatsapp_at',
        'consecutive_down_alert_count',
        'check_interval',
        'next_check_at',
    ];

    protected $casts = [
        'is_active'          => 'boolean',
        'check_interval'     => 'integer',
        'next_check_at'      => 'datetime',
        'last_checked_at'    => 'datetime',
        'ssl_valid_from'     => 'datetime',
        'ssl_valid_to'       => 'datetime',
        'ssl_last_checked_at' => 'datetime',
        'domain_expires_at'  => 'datetime',
        'domain_days_remaining' => 'integer',
        'domain_last_checked_at' => 'datetime',
        'ssl_expiry_notified_days' => 'integer',
        'failure_count'      => 'integer',
        'last_sms_at'        => 'datetime',
        'last_whatsapp_at'   => 'datetime',
        'consecutive_down_alert_count' => 'integer',
    ];


    public function company()
    {
        return $this->belongsTo(Workspace::class, 'workspace_id', 'id');
    }

    public function workspace()
    {
        return $this->company();
    }

    public function domainIntegrations()
    {
        return $this->hasMany(DomainIntegration::class);
    }

    public function notificationChannels()
    {
        return $this->hasMany(NotificationChannel::class);
    }
    public function isFirstHealthCheck(): bool
    {
        return $this->getOriginal('last_checked_at') === null;
    }

    public function integrations()
    {
        return $this->belongsToMany(
            Integration::class,
            'domain_integrations'
        )->withPivot('enabled')
            ->withTimestamps();
    }

    public function incidents()
    {
        return $this->hasMany(Incident::class);
    }

    public function latestIncident()
    {
        return $this->hasOne(Incident::class)->latestOfMany();
    }

    public function aiAnalysis(): HasOne
    {
        return $this->hasOne(DomainAiAnalysis::class);
    }

    public function facebookAssignments(): HasMany
    {
        return $this->hasMany(DomainFacebookAssignment::class);
    }

    public function googleAssignments(): HasMany
    {
        return $this->hasMany(DomainGoogleAssignment::class);
    }

    /**
     * Get the Facebook integration linked to this domain (if any).
     * A domain can only be linked to ONE Facebook integration.
     */
    public function getLinkedFacebookIntegration()
    {
        $assignment = $this->facebookAssignments()->with('userIntegration')->first();
        return $assignment?->userIntegration;
    }

    /**
     * Get the Google Ads integration linked to this domain (if any).
     */
    public function getLinkedGoogleIntegration()
    {
        $assignment = $this->googleAssignments()->with('userIntegration')->first();
        return $assignment?->userIntegration;
    }

    public function isPlanLimitPaused(): bool
    {
        return $this->paused_reason === 'plan_limit';
    }

    public function isUserPaused(): bool
    {
        return $this->paused_reason === 'user';
    }

    /**
     * Check whether this domain is currently due for an uptime check.
     */
    public function isDueForCheck(): bool
    {
        if (!$this->is_active || $this->paused_reason !== null) {
            return false;
        }

        if ($this->next_check_at === null) {
            return true;
        }

        return $this->next_check_at->isPast();
    }

    /**
     * Get the effective check interval in minutes, respecting the plan's minimum check interval.
     */
    public function getEffectiveCheckInterval(): int
    {
        $minInterval = 1;
        if ($this->company) {
            $minInterval = \App\Services\PlanLimitService::getMonitorIntervalMinutes($this->company);
        }

        $checkInterval = (int) ($this->check_interval ?: $minInterval);
        if ($minInterval < 5 && $checkInterval === 5) {
            $checkInterval = $minInterval;
        }

        return max($checkInterval, $minInterval);
    }

    /**
     * Calculate and update the next_check_at timestamp based on check_interval and plan limits.
     */
    public function scheduleNextCheck(?int $intervalMinutes = null): void
    {
        $interval = $intervalMinutes ?? $this->getEffectiveCheckInterval();
        $this->next_check_at = now()->addMinutes($interval);
    }
}

