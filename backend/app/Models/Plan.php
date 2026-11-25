<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Plan extends Model
{
    protected $fillable = [
        'name',
        'code',
        'max_domains',
        'max_team_members',
        'max_status_pages',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    /*
    |--------------------------------------------------------------------------
    | Relationships
    |--------------------------------------------------------------------------
    */

    public function prices(): HasMany
    {
        return $this->hasMany(PlanPrice::class);
    }

    /*
    |--------------------------------------------------------------------------
    | Helpers
    |--------------------------------------------------------------------------
    */

    public function isEnterprise(): bool
    {
        return $this->code === 'enterprise';
    }

    public function isCustom(): bool
    {
        return in_array($this->code, ['custom', 'enterprise'], true);
    }

    public function isSelfServe(): bool
    {
        return in_array($this->code, ["free", "starter", "solopreneur", "teams"], true);
    }

}
