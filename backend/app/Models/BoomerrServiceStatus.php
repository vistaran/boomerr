<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BoomerrServiceStatus extends Model
{
    protected $table      = 'boomerr_service_status';
    protected $primaryKey = 'service_id';
    public    $incrementing = false;
    protected $keyType    = 'string';
    public    $timestamps = false;

    protected $fillable = [
        'service_id',
        'service_name',
        'status',
        'uptime_7d',
        'uptime_30d',
        'uptime_90d',
        'checks_today',
        'failures_today',
        'updated_at',
    ];

    protected $casts = [
        'uptime_7d'      => 'float',
        'uptime_30d'     => 'float',
        'uptime_90d'     => 'float',
        'checks_today'   => 'integer',
        'failures_today' => 'integer',
        'updated_at'     => 'datetime',
    ];
}
