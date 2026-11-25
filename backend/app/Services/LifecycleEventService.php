<?php

namespace App\Services;

use App\Models\LifecycleEvent;
use App\Models\User;
use Illuminate\Support\Facades\Log;

class LifecycleEventService
{
    /**
     * Dispatch a lifecycle event for a user.
     *
     * @param User $user
     * @param string $eventName e.g., 'user_registered', 'monitor_created'
     * @param array $eventData
     * @return LifecycleEvent
     */
    public function dispatch(User $user, string $eventName, array $eventData = []): LifecycleEvent
    {
        Log::info("Lifecycle Event Dispatched: {$eventName}", [
            'user_id' => $user->id,
            'data' => $eventData
        ]);

        return LifecycleEvent::create([
            'user_id' => $user->id,
            'event_name' => $eventName,
            'event_data' => $eventData,
        ]);
    }

    /**
     * Check if a user has triggered a specific event.
     */
    public function hasTriggered(User $user, string $eventName): bool
    {
        return LifecycleEvent::where('user_id', $user->id)
            ->where('event_name', $eventName)
            ->exists();
    }
}
