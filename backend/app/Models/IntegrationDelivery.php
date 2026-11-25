<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Support\Str;

class IntegrationDelivery extends Model
{
    protected static function booted(): void
    {
        static::creating(function (self $model) {
            if (empty($model->ulid)) {
                $model->ulid = strtolower((string) Str::ulid());
            }
        });
    }

    protected $fillable = [
        'ulid',
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
        'http_status' => 'integer',
        'attempt' => 'integer',
        'duration_ms' => 'integer',
    ];

    public function deliverable(): MorphTo
    {
        return $this->morphTo();
    }
}
