<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\LifecycleEventService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LifecycleEventServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_dispatches_and_records_event()
    {
        $user = User::factory()->create();
        $service = new LifecycleEventService();

        $event = $service->dispatch($user, 'test_event', ['foo' => 'bar']);

        $this->assertDatabaseHas('lifecycle_events', [
            'user_id' => $user->id,
            'event_name' => 'test_event',
        ]);

        $this->assertEquals(['foo' => 'bar'], $event->event_data);
        $this->assertTrue($service->hasTriggered($user, 'test_event'));
    }
}
