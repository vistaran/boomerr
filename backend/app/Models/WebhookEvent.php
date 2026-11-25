<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WebhookEvent extends Model
{
    protected $fillable = [
        'webhook_id',
        'event_name',
    ];

    public function webhook()
    {
        return $this->belongsTo(Webhook::class);
    }
}
