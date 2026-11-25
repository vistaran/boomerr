<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class GoogleAdsCampaign extends Model
{
    use HasFactory;

    protected $table = 'google_ads_campaigns';

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
        'google_ads_account_id',
        'campaign_id',
        'name',
        'status',
        'advertising_channel_type',
        'budget_micros',
        'start_date',
        'end_date',
        'meta_json',
    ];

    protected $casts = [
        'budget_micros' => 'integer',
        'start_date' => 'date',
        'end_date' => 'date',
        'meta_json' => 'array',
    ];

    public function account(): BelongsTo
    {
        return $this->belongsTo(GoogleAdsAccount::class, 'google_ads_account_id');
    }

    public function ads(): HasMany
    {
        return $this->hasMany(GoogleAdsAd::class, 'google_ads_campaign_id');
    }
}
