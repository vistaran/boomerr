<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DomainIntegration extends Model
{
    use HasUlids;

    protected $hidden = ['id'];

    public function getRouteKeyName(): string
    {
        return 'ulid';
    }

    public function uniqueIds(): array
    {
        return ['ulid'];
    }

    public $timestamps = false;
    protected $table = 'domain_integrations';
    protected $fillable = [
        'ulid',
        'domain_id',
        'integration_id',
        'enabled',
    ];

    public function integration()
    {
        return $this->belongsTo(Integration::class);
    }

    public function domain()
    {
        return $this->belongsTo(Domain::class);
    }

    public function notificationChannels(): HasMany
    {
        return $this->hasMany(NotificationChannel::class, 'integration_id', 'id')
            ->where('domain_id', $this->domain_id);
    }
}
