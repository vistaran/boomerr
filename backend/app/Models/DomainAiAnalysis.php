<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DomainAiAnalysis extends Model
{
    protected $fillable = [
        'domain_id',
        'scores',
        'suggestions',
    ];

    protected $casts = [
        'scores' => 'array',
        'suggestions' => 'array',
    ];

    public function domain(): BelongsTo
    {
        return $this->belongsTo(Domain::class);
    }
}
