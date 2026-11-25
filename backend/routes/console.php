<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('monitor:run-ssl-checks')->everyMinute()->withoutOverlapping();
// Laravel's scheduler does not support intervals less than 1 minute natively.
// To run a command every 30 seconds, schedule it every minute and add a cron job to run the scheduler every 30 seconds.
// Here is the standard scheduler call:
Schedule::command('monitor:run-uptime-checks')->everyMinute()->withoutOverlapping();
Schedule::command('monitor:run-lambda-checks')->everyMinute()->withoutOverlapping();
Schedule::command('system-logs:prune')->dailyAt('02:30')->withoutOverlapping();
if (config('billing.enabled', false)) {
    Schedule::command('trial:reminders')->daily()->withoutOverlapping();
}
Schedule::command('status:refresh')->everyFiveMinutes()->withoutOverlapping();
Schedule::command('monitor:run-whois-checks')->daily()->withoutOverlapping();

// Lifecycle Automations (Onboarding, Trial Ending, Churn Prevention, Reactivation)
Schedule::job(new \App\Jobs\ProcessLifecycleAutomations())->hourly()->withoutOverlapping();

// Monitor Aggregations
Schedule::command('monitor:aggregate-daily')->dailyAt('00:05')->withoutOverlapping();
