<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class IncidentAIChat extends Model
{
    protected $table = 'incident_ai_chat';

    protected $fillable = [
        'incident_id',
        'role',
        'message',
    ];
}
