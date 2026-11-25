<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WebhookDelivery extends Model
{
    protected $fillable = [
        'webhook_id',
        'event_id',
        'event_name',
        'http_status',
        'status',
        'attempt',
        'request_payload',
        'response_headers',
        'response_body',
        'duration_ms',
    ];

    protected $casts = [
        'request_payload' => 'array',
        'response_headers' => 'array',
    ];

    public function webhook()
    {
        return $this->belongsTo(Webhook::class);
    }
}
