<?php

namespace Tests\Feature;

use App\Jobs\ProcessLifecycleAutomations;
use App\Mail\Onboarding\WelcomeEmail;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class OnboardingLifecycleTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_dispatches_lifecycle_event_and_job_on_completion()
    {
        Queue::fake();

        $user = User::factory()->create();

        $response = $this->actingAs($user)->postJson('/api/onboarding', [
            'onboarding_completed' => true
        ]);

        $response->assertStatus(200);

        $this->assertDatabaseHas('lifecycle_events', [
            'user_id' => $user->id,
            'event_name' => 'onboarding_completed'
        ]);

        Queue::assertPushed(ProcessLifecycleAutomations::class, function ($job) use ($user) {
            return $job->targetUser->id === $user->id;
        });
    }

    public function test_it_queues_welcome_email_when_job_is_processed()
    {
        Mail::fake();

        $user = User::factory()->create();

        // Simulate onboarding_completed event
        $lifecycleService = app(\App\Services\LifecycleEventService::class);
        $lifecycleService->dispatch($user, 'onboarding_completed', []);

        // Process job
        $job = new ProcessLifecycleAutomations($user);
        $job->handle();

        Mail::assertQueued(WelcomeEmail::class, function ($mail) use ($user) {
            return $mail->hasTo($user->email);
        });

        $this->assertDatabaseHas('email_deliveries', [
            'user_id' => $user->id,
            'event_name' => 'onboarding_email_1'
        ]);
    }

    public function test_it_does_not_send_welcome_email_if_not_completed()
    {
        Mail::fake();

        $user = User::factory()->create();
        
        // No onboarding_completed event dispatched

        // Process job
        $job = new ProcessLifecycleAutomations($user);
        $job->handle();

        Mail::assertNothingQueued();

        $this->assertDatabaseMissing('email_deliveries', [
            'user_id' => $user->id,
            'event_name' => 'onboarding_email_1'
        ]);
    }
}
