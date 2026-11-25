<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BillingEvent extends Model
{
    protected $fillable = [
        'razorpay_event_id',
        'event_type',
        'gateway_subscription_id',
        'gateway_payment_id',
        'payload',
        'status',
        'error_message',
        'processed_at',
    ];

    protected $casts = [
        'payload' => 'array',
        'processed_at' => 'datetime',
    ];
}
