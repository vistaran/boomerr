<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class StatusPage extends Model
{
    use HasUlids;

    protected $fillable = [
        'ulid',
        'workspace_id',
        'name',
        'slug',
        'is_published',
        'logo_path',
    ];

    protected $casts = [
        'is_published' => 'boolean',
    ];

    public function getRouteKeyName(): string
    {
        return 'ulid';
    }

    public function uniqueIds(): array
    {
        return ['ulid'];
    }

    /**
     * Get the workspace that owns the status page.
     */
    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    /**
     * Get the domains associated with this status page.
     */
    public function domains(): BelongsToMany
    {
        return $this->belongsToMany(Domain::class, 'status_page_domains')
                    ->withTimestamps();
    }
}
