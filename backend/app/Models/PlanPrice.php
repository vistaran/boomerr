<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PlanPrice extends Model
{
    protected $fillable = [
        'plan_id',
        'interval',
        'price',
        'currency',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'price' => 'integer',
    ];

    /*
    |--------------------------------------------------------------------------
    | Relationships
    |--------------------------------------------------------------------------
    */

    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class);
    }

    public function gatewayMappings(): HasMany
    {
        return $this->hasMany(PlanGatewayMapping::class);
    }

    public function subscriptions(): HasMany
    {
        return $this->hasMany(Subscription::class);
    }

    /*
    |--------------------------------------------------------------------------
    | Helpers
    |--------------------------------------------------------------------------
    */

    public function formattedPrice(): string
    {
        return number_format($this->price / 100, 2);
    }
}
