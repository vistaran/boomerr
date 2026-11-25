<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class NotificationChannel extends Model
{
    // Generate a separate `ulid` column on create instead of using the model
    // primary key as a ULID (the table uses an integer `id` PK).
    protected static function booted(): void
    {
        static::creating(function (self $model) {
            if (empty($model->ulid)) {
                $model->ulid = strtolower((string) Str::ulid());
            }
        });
    }

    public function uniqueIds(): array
    {
        return ['ulid'];
    }

    protected $fillable = [
        'ulid',
        'workspace_id',
        'domain_id',
        'integration_id',
        'name',
        'url',
        'is_active',
        'type',
        'events',
        'last_trigger_status',
        'meta_json'
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'events' => 'array',
        'meta_json' => 'array',
    ];

    /* ================= Relations ================= */

    public function workspace()
    {
        return $this->belongsTo(Workspace::class);
    }

    public function domain()
    {
        return $this->belongsTo(Domain::class);
    }

    public function domainIntegration()
    {
        return $this->belongsTo(DomainIntegration::class, 'integration_id');
    }

    public function integration()
    {
        return $this->domainIntegration->integration();
    }

    public function deliveries()
    {
        return $this->morphMany(IntegrationDelivery::class, 'deliverable');
    }

    /* ================= Business Logic ================= */

    public function isEffectivelyActive(): bool
    {
        return \App\Services\NotificationChannelStatusService::isChannelActive($this);
    }
}
