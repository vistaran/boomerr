<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;

class WorkspaceIntegration extends Model
{
    use HasUlids;

    protected $hidden = ['id'];
    public $timestamps = false;
    protected $table = 'workspace_integrations';
    protected $fillable = [
        'ulid',
        'workspace_id',
        'integration_id',
        'enabled',
    ];

    public function getRouteKeyName(): string
    {
        return 'ulid';
    }

    public function uniqueIds(): array
    {
        return ['ulid'];
    }

    public function integration()
    {
        return $this->belongsTo(Integration::class);
    }

    public function workspace()
    {
        return $this->belongsTo(Workspace::class);
    }
}
