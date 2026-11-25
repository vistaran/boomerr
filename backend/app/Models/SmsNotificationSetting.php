<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SmsNotificationSetting extends Model
{
    protected $fillable = [
        'workspace_id',
        'domain_id',
        'user_id',
        'name',
        'sms_enabled',
        'phone_number',
        'down_threshold',
        'ssl_days_before',
        'events',
    ];

    protected $casts = [
        'sms_enabled'     => 'boolean',
        'down_threshold'  => 'integer',
        'ssl_days_before' => 'integer',
        'events'          => 'array',
    ];

    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function deliveries()
    {
        return $this->morphMany(IntegrationDelivery::class, 'deliverable');
    }
}
