<?php

use Illuminate\Support\Facades\Broadcast;
use App\Models\User;
use Illuminate\Support\Facades\Log;

Broadcast::routes([
    'middleware' => ['auth:sanctum'],
]);

// Private realtime channel for each company
Broadcast::channel('company.{workspaceId}', function ($user, int $workspaceId) {
    if (! $user instanceof User) {
        return false;
    }

    return (int) ($user->currentWorkspaceId() ?? 0) === (int) $workspaceId;
});

// Per-user notification channel used by Laravel's broadcast notifications
Broadcast::channel('App.Models.User.{id}', function ($user, int $id) {
    if (! $user instanceof User) {
        return false;
    }

    return (int) $user->id === (int) $id;
});
