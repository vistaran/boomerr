<?php

namespace App\Models;

use App\Enums\SubscriptionStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Subscription extends Model
{
    protected $fillable = [
        'workspace_id',
        'plan_price_id',
        'scheduled_plan_price_id',
        'switch_requested_plan_price_id',
        'switch_requested_interval',
        'switch_requested_at',
        'gateway',
        'gateway_subscription_id',
        'gateway_payment_url',
        'gateway_customer_id',
        'currency',
        'unit_amount',
        'status',
        'trial_ends_at',
        'current_period_start',
        'current_period_end',
        'cancelled_at',
        'failed_payment_attempts',
        'last_payment_failed_at',
    ];

    protected $casts = [
        'trial_ends_at' => 'datetime',
        'current_period_start' => 'datetime',
        'current_period_end' => 'datetime',
        'cancelled_at' => 'datetime',
        'last_payment_failed_at' => 'datetime',
        'switch_requested_at' => 'datetime',
    ];

    /*
    |--------------------------------------------------------------------------
    | Relationships
    |--------------------------------------------------------------------------
    */

    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    public function planPrice(): BelongsTo
    {
        return $this->belongsTo(PlanPrice::class);
    }

    public function scheduledPlanPrice(): BelongsTo
    {
        return $this->belongsTo(PlanPrice::class, 'scheduled_plan_price_id');
    }

    public function paymentTransactions(): HasMany
    {
        return $this->hasMany(PaymentTransaction::class);
    }

    /*
    |--------------------------------------------------------------------------
    | Helpers
    |--------------------------------------------------------------------------
    */

    public function isActive(): bool
    {
        return $this->status === SubscriptionStatus::ACTIVE;
    }

    public function isTrialing(): bool
    {
        return $this->status === SubscriptionStatus::TRIALING;
    }

    public function isPastDue(): bool
    {
        return in_array($this->status, [SubscriptionStatus::PAST_DUE, SubscriptionStatus::PENDING, SubscriptionStatus::HALTED], true);
    }

    public function hasEnded(): bool
    {
        return in_array($this->status, SubscriptionStatus::terminalStatuses(), true);
    }

    public function hasMaxFailedAttempts(): bool
    {
        $maxAttempts = (int) config('billing.max_failed_payment_attempts', 3);

        return $this->failed_payment_attempts >= $maxAttempts;
    }
}
