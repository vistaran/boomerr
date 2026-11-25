<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PlanGatewayMapping extends Model
{
    protected $fillable = [
        'plan_price_id',
        'gateway',
        'gateway_plan_id',
    ];

    /*
    |--------------------------------------------------------------------------
    | Relationships
    |--------------------------------------------------------------------------
    */

    public function planPrice(): BelongsTo
    {
        return $this->belongsTo(PlanPrice::class);
    }
}
