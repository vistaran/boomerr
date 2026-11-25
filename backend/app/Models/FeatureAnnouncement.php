<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class FeatureAnnouncement extends Model
{
    protected $fillable = [
        'title',
        'slug',
        'category',
        'status',
        'badge_text',
        'summary',
        'description',
        'cta_label',
        'cta_url',
        'target_quarter',
        'release_date',
        'is_pinned',
        'is_published',
        'created_by',
    ];

    protected $casts = [
        'is_pinned' => 'boolean',
        'is_published' => 'boolean',
        'release_date' => 'date',
    ];

    public function setReleaseDateAttribute($value)
    {
        $this->attributes['release_date'] = !empty($value) ? $value : null;
    }

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
            if (empty($model->slug)) {
                $baseSlug = Str::slug($model->title);
                $slug = $baseSlug;
                $count = 1;
                while (static::where('slug', $slug)->exists()) {
                    $slug = "{$baseSlug}-{$count}";
                    $count++;
                }
                $model->slug = $slug;
            }
        });
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(Admin::class, 'created_by');
    }

    public function scopePublished($query)
    {
        return $query->where('is_published', true);
    }

    public function scopePinned($query)
    {
        return $query->where('is_pinned', true);
    }
}

