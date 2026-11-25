<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MonitoringRegion extends Model
{
    protected $fillable = [
        'name',
        'aws_region',
        'lambda_function_name',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];
}
