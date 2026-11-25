<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class GoogleAdsAccount extends Model
{
    use HasUlids, HasFactory;

    protected $table = 'google_ads_accounts';

    protected static function boot()
    {
        parent::boot();
        static::creating(function ($model) {
            if (empty($model->ulid)) {
                $model->ulid = (string) Str::ulid();
            }
        });
    }

    public function uniqueIds(): array
    {
        return ['ulid'];
    }

    protected $fillable = [
        'ulid',
        'user_integration_id',
        'customer_id',
        'descriptive_name',
        'currency_code',
        'time_zone',
        'is_manager',
        'is_active',
        'meta_json',
    ];

    protected $casts = [
        'is_manager' => 'boolean',
        'is_active' => 'boolean',
        'meta_json' => 'array',
    ];

    public function userIntegration(): BelongsTo
    {
        return $this->belongsTo(UserIntegration::class);
    }

    public function campaigns(): HasMany
    {
        return $this->hasMany(GoogleAdsCampaign::class);
    }
}
