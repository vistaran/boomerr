<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PaymentTransaction extends Model
{
    protected $fillable = [
        'workspace_id',
        'subscription_id',
        'gateway',
        'gateway_payment_id',
        'amount',
        'currency',
        'status',
        'description',
        'paid_at',
    ];

    protected $casts = [
        'paid_at' => 'datetime',
    ];

    protected $appends = ['formatted_amount'];

    /*
    |--------------------------------------------------------------------------
    | Relationships
    |--------------------------------------------------------------------------
    */

    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    public function subscription(): BelongsTo
    {
        return $this->belongsTo(Subscription::class);
    }

    /*
    |--------------------------------------------------------------------------
    | Accessors
    |--------------------------------------------------------------------------
    */

    /**
     * Amount formatted in major currency unit (e.g. ₹499.00 from 49900 paise).
     */
    public function getFormattedAmountAttribute(): string
    {
        if ($this->amount === null) {
            return '-';
        }

        $major = $this->amount / 100;
        $symbol = match (strtoupper($this->currency)) {
            'INR' => '₹',
            'USD' => '$',
            'EUR' => '€',
            default => $this->currency . ' ',
        };

        return $symbol . number_format($major, 2);
    }
}
