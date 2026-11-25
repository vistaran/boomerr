<?php

namespace App\Console\Commands;

use App\Models\Subscription;
use Illuminate\Console\Command;
use App\Notifications\TrialEndingReminderNotification;
use Illuminate\Support\Facades\DB;

class SendTrialEndingReminders extends Command
{
    protected $signature = 'trial:reminders';

    protected $description = 'Send reminders to users whose trial ends soon';

    public function handle()
    {
        if (!config('billing.enabled', false)) {
            $this->info('Billing is disabled (Community Edition). Trial reminders skipped.');
            return 0;
        }

        Subscription::with('workspace.users')
            ->where('status', 'trialing')
            ->whereIn(
                DB::raw('DATE(trial_ends_at)'),
                [now()->addDays(3)->toDateString(), now()->addDay()->toDateString()]
            )
            ->each(function ($subscription) {

                $workspace = $subscription->workspace;

                // Notify workspace owner (recommended)
                $owner = $workspace->users()
                    ->wherePivot('role', 'owner')
                    ->first();

                if ($owner) {
                    $owner->notify(
                        new TrialEndingReminderNotification($subscription)
                    );
                }
            });

        $this->info('Trial reminder notifications sent.');
    }
}
