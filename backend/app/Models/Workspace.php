<?php

namespace App\Models;

use App\Enums\SubscriptionStatus;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Notifications\Notifiable;
use App\Services\PlanLimitService;

class Workspace extends Model
{
    use Notifiable, HasUlids, HasFactory;

    protected $hidden = ['id'];

    public function getRouteKeyName(): string
    {
        return 'ulid';
    }

    public function uniqueIds(): array
    {
        return ['ulid'];
    }

    protected $table = 'workspaces';
    /**
     * Get the channels the event should broadcast on.
     *
     * @return \Illuminate\Broadcasting\Channel|array
     */

    public function broadcastOn()
    {
        return [];
    }

    protected $fillable = [
        'ulid',
        'name',
        'slug',
        'industry',
        'primary_contact_email',
        'timezone',
        'plan_id',
        'billing_status',
        'razorpay_subscription_id',
        'trial_started_at',
        'trial_ends_at',
        'billing_cycle_ends_at',
        'cancel_at_cycle_end',
        'payment_fail_count',
        'grace_period_ends_at',
        'subscription_creation_lock',
        'developer_webhooks_enabled',
    ];

    protected function casts(): array
    {
        return [
            'trial_started_at' => 'datetime',
            'trial_ends_at' => 'datetime',
            'billing_cycle_ends_at' => 'datetime',
            'grace_period_ends_at' => 'datetime',
            'cancel_at_cycle_end' => 'boolean',
            'subscription_creation_lock' => 'boolean',
            'developer_webhooks_enabled' => 'boolean',
            'onboarding_settings' => 'array',
        ];
    }

    public function domains()
    {
        return $this->hasMany(Domain::class);
    }

    public function statusPages()
    {
        return $this->hasMany(StatusPage::class);
    }

    public function plan()
    {
        return $this->belongsTo(Plan::class);
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'workspace_user')
            ->withPivot('role', 'is_current')
            ->withTimestamps();
    }

    public function notificationChannels()
    {
        return $this->hasMany(NotificationChannel::class, 'workspace_id', 'id');
    }

    public function routeNotificationForMail($notification): ?string
    {
        if ($this->primary_contact_email) {
            return $this->primary_contact_email;
        }

        // Fallback to the owner of the workspace if primary contact is not set
        $owner = $this->users()->wherePivot('role', 'owner')->first();
        return $owner ? $owner->email : null;
    }

    public function integrations()
    {
        return $this->belongsToMany(
            Integration::class,
            'workspace_integrations'
        )->withPivot('enabled')
            ->withTimestamps();
    }

    public function subscriptions()
    {
        return $this->hasMany(Subscription::class);
    }

    public function activeSubscription()
    {
        return $this->hasOne(Subscription::class)
            ->whereIn('status', SubscriptionStatus::nonTerminalStatuses())
            ->orderByRaw("CASE
                WHEN gateway_subscription_id IS NOT NULL THEN 0
                WHEN unit_amount > 0 THEN 0
                ELSE 1
            END")
            ->orderByRaw("CASE status
                WHEN 'trialing' THEN 1
                WHEN 'active' THEN 2
                WHEN 'authenticated' THEN 3
                WHEN 'pending' THEN 4
                WHEN 'past_due' THEN 5
                WHEN 'cancel_at_cycle_end' THEN 6
                WHEN 'failed_retrying' THEN 7
                WHEN 'halted' THEN 8
                WHEN 'created' THEN 9
                ELSE 99
            END")
            ->latest('id');
    }

    public function isPastDue(): bool
    {
        $subscription = $this->activeSubscription()->first();
        return $subscription && in_array($subscription->status, [SubscriptionStatus::PAST_DUE, SubscriptionStatus::PENDING, SubscriptionStatus::HALTED], true);
    }

    /*
    |--------------------------------------------------------------------------
    | Plan Helpers (delegates to PlanLimitService)
    |--------------------------------------------------------------------------
    */

    public function canAddMonitor(): bool
    {
        return PlanLimitService::canAddMonitor($this);
    }

    public function canAddTeamMember(): bool
    {
        return PlanLimitService::canAddTeamMember($this);
    }

    public function canAddStatusPage(): bool
    {
        return PlanLimitService::canAddStatusPage($this);
    }

    public function hasFeature(string $feature): bool
    {
        return PlanLimitService::hasFeature($this, $feature);
    }

    public function hasIntegration(string $integration): bool
    {
        return PlanLimitService::hasIntegration($this, $integration);
    }
}
