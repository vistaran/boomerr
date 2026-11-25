<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class UserIntegration extends Model
{
    use HasUlids, HasFactory;

    protected $table = 'user_integrations';

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
        'user_id',
        'workspace_id',
        'provider',
        'account_id',
        'access_token',
        'meta_json',
        'status',
        'connected_at',
    ];

    protected $casts = [
        'connected_at' => 'datetime',
        'meta_json' => 'array',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function workspace()
    {
        return $this->belongsTo(Workspace::class);
    }

    public function domainAssignments()
    {
        return $this->hasMany(DomainFacebookAssignment::class);
    }

    public function googleAdsAccounts()
    {
        return $this->hasMany(GoogleAdsAccount::class);
    }
}
