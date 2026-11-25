<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class GoogleAdsAd extends Model
{
    use HasFactory;

    protected $table = 'google_ads_ads';

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
        'google_ads_campaign_id',
        'ad_group_id',
        'ad_id',
        'name',
        'status',
        'type',
        'headlines',
        'descriptions',
        'final_urls',
        'meta_json',
    ];

    protected $casts = [
        'headlines' => 'array',
        'descriptions' => 'array',
        'final_urls' => 'array',
        'meta_json' => 'array',
    ];

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(GoogleAdsCampaign::class, 'google_ads_campaign_id');
    }
}
