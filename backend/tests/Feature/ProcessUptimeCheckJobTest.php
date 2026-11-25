<?php

namespace Tests\Feature;

use App\Jobs\ProcessUptimeCheckJob;
use App\Models\Domain;
use App\Services\DomainHealthService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Mockery\MockInterface;
use Tests\TestCase;

class ProcessUptimeCheckJobTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_dispatches_job_successfully()
    {
        Queue::fake();

        $domain = Domain::factory()->create(['is_active' => true]);

        ProcessUptimeCheckJob::dispatch($domain->id);

        Queue::assertPushed(ProcessUptimeCheckJob::class, function ($job) use ($domain) {
            return $job->domainId === $domain->id;
        });
    }

    public function test_it_processes_uptime_check_for_existing_domain()
    {
        $domain = Domain::factory()->create(['is_active' => true]);

        $this->mock(DomainHealthService::class, function (MockInterface $mock) use ($domain) {
            $mock->shouldReceive('runUptimeCheck')
                ->once()
                ->withArgs(function ($passedDomain) use ($domain) {
                    return $passedDomain->id === $domain->id;
                });
        });

        $job = new ProcessUptimeCheckJob($domain->id);
        $job->handle(app(DomainHealthService::class));
    }

    public function test_it_handles_missing_domain_gracefully()
    {
        $this->mock(DomainHealthService::class, function (MockInterface $mock) {
            $mock->shouldNotReceive('runUptimeCheck');
        });

        // 9999 is a non-existent domain ID
        $job = new ProcessUptimeCheckJob(9999);
        $job->handle(app(DomainHealthService::class));
    }
}
