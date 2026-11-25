<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class TeamInvitation extends Model
{
    use HasFactory, HasUlids;

    protected $hidden = ['id'];

    public function getRouteKeyName(): string
    {
        return 'ulid';
    }

    public function uniqueIds(): array
    {
        return ['ulid'];
    }

    protected $fillable = [
        'ulid',
        'workspace_id',
        'email',
        'role',
        'token',
        'expires_at',
        'is_accepted',
        'department_id',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
    ];
}
