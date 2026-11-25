<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DomainStatusEvent extends Model
{
    use HasFactory;

    protected $fillable = [
        'domain_id',
        'incident_id',
        'status',
        'response_time_ms',
        'region',
        'location',
        'checked_at',
        'check_source',
        'http_status',
    ];

    protected $casts = [
        'checked_at' => 'datetime',
    ];

    public function domain()
    {
        return $this->belongsTo(Domain::class);
    }

    public function incident()
    {
        return $this->belongsTo(Incident::class);
    }
}
