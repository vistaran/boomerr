<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class NewsletterSubscriber extends Model
{
    use HasFactory;

    protected $fillable = [
        'email',
        'token',
        'is_active',
        'confirmed_at',
        'unsubscribed_at',
    ];

    protected $attributes = [
        'is_active' => true,
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'confirmed_at' => 'datetime',
        'unsubscribed_at' => 'datetime',
    ];

    /**
     * Auto-generate a random 64-char token on creation for secure unsubscribe links.
     */
    protected static function booted(): void
    {
        static::creating(function (self $model) {
            if (empty($model->token)) {
                $model->token = Str::random(64);
            }
            if (empty($model->confirmed_at)) {
                $model->confirmed_at = now();
            }
        });
    }

    /**
     * Scope query to only active subscribers.
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    /**
     * Unsubscribe this subscriber.
     */
    public function unsubscribe(): bool
    {
        $this->is_active = false;
        $this->unsubscribed_at = now();
        return $this->save();
    }

    /**
     * Resubscribe this subscriber.
     */
    public function resubscribe(): bool
    {
        $this->is_active = true;
        $this->unsubscribed_at = null;
        return $this->save();
    }
}
