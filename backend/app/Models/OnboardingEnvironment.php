<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class OnboardingEnvironment extends Model
{
    use HasFactory;

    protected $fillable = [
        'value',
        'label',
        'icon',
        'description',
        'color',
        'bg_color',
        'border_color',
        'sort_order',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];
}
