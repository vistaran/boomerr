<?php

namespace App\Jobs;

use App\Mail\FeatureAnnouncementMail;
use App\Models\FeatureAnnouncement;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class SendFeatureAnnouncementEmailJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $feature;

    /**
     * Create a new job instance.
     */
    public function __construct(FeatureAnnouncement $feature)
    {
        $this->feature = $feature;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        Log::info("Dispatching feature announcement emails for [{$this->feature->title}]");

        // Chunk users to avoid memory pressure and filter only valid emails
        User::whereNotNull('email')
            ->where('email', 'like', '%@%')
            ->select('id', 'name', 'email')
            ->orderBy('id')
            ->chunk(100, function ($users) {
                foreach ($users as $user) {
                    if (!filter_var($user->email, FILTER_VALIDATE_EMAIL)) {
                        continue;
                    }

                    try {
                        Mail::to($user->email)->queue(new FeatureAnnouncementMail($this->feature, $user));
                    } catch (\Throwable $e) {
                        Log::error("Failed to send feature announcement to user {$user->email}: " . $e->getMessage());
                    }
                }
            });

        Log::info("Completed sending feature announcement emails for [{$this->feature->title}]");
    }
}

