<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class EmailCampaign extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'type',
        'status',
        'provider',
        'metadata',
    ];

    protected $casts = [
        'metadata' => 'array',
    ];

    public function deliveries(): HasMany
    {
        return $this->hasMany(EmailDelivery::class);
    }
}
