<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\Workspace as Company;
use Illuminate\Database\Eloquent\Concerns\HasUlids;

class Department extends Model
{
    use HasUlids;

    protected $hidden = ['id'];

    public function getRouteKeyName(): string
    {
        return 'ulid';
    }

    public function uniqueIds(): array
    {
        return ['ulid'];
    }

    protected $fillable = ['ulid', 'name', 'workspace_id'];

    public function users()
    {
        return $this->belongsToMany(User::class)
            ->withPivot('workspace_id')
            ->withTimestamps();
    }

    public function company()
    {
        return $this->belongsTo(Workspace::class, 'workspace_id', 'id');
    }
}
