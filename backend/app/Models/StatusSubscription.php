<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class StatusSubscription extends Model
{
    protected $fillable = [
        'email',
        'token',
        'confirmed_at',
    ];

    protected $casts = [
        'confirmed_at' => 'datetime',
    ];

    /**
     * Auto-generate a random token on creation.
     */
    protected static function booted(): void
    {
        static::creating(function (self $model) {
            if (empty($model->token)) {
                $model->token = Str::random(64);
            }
        });
    }
}
