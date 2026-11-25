<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\User;
use App\Models\EmailDelivery;
use App\Mail\Newsletter\WeeklyUptimeReportEmail;
use Illuminate\Support\Facades\Mail;

class SendWeeklyNewsletter extends Command
{
    protected $signature = 'app:send-weekly-newsletter';
    protected $description = 'Send the weekly Uptime Report newsletter to users';

    public function handle()
    {
        $this->info('Starting weekly newsletter dispatch...');

        User::with('workspaces')->chunk(100, function ($users) {
            foreach ($users as $user) {
                if (!$user->receives_newsletters) continue;

                // Simple check to prevent double-sending in a single week
                $sentThisWeek = EmailDelivery::where('user_id', $user->id)
                    ->where('event_name', 'weekly_newsletter')
                    ->where('created_at', '>=', now()->subDays(6))
                    ->exists();

                if ($sentThisWeek) continue;

                $workspace = $user->currentWorkspace();
                $persona = $workspace ? $workspace->industry : 'default'; // Using the industry field we discussed adding earlier, or fall back

                $industryNews = "Major cloud providers saw a 12% increase in micro-outages this week. Are your multi-region failovers ready?";
                $featureSpotlight = "Did you know you can connect Slack to get incident alerts instantly?";
                $educationalTip = "Set your monitor interval to 1-minute to catch micro-downtimes that hurt SEO.";

                if ($persona === 'ecommerce') {
                    $industryNews = "Holiday shopping traffic caused a 15% spike in server overloads for major retailers this week.";
                    $featureSpotlight = "Protect your ROAS by ensuring Google Ads auto-pause is enabled for your storefront.";
                    $educationalTip = "Downtime during checkout costs an average of $2k/minute for e-commerce sites. Ensure your checkout flow is monitored separately.";
                } elseif ($persona === 'agency') {
                    $industryNews = "Client reporting transparency is becoming a major retention factor for agencies.";
                    $featureSpotlight = "Create a custom Public Status Page to automatically keep your clients informed of their site's health.";
                    $educationalTip = "Use Boomerr's multi-team feature to give read-only dashboard access to your clients.";
                } elseif ($persona === 'saas') {
                    $industryNews = "API downtime is up 8% this month across B2B SaaS providers.";
                    $featureSpotlight = "You can monitor raw API endpoints just as easily as HTML pages. Add your API to Boomerr today.";
                    $educationalTip = "Make sure to configure keyword assertions so we can verify your API is returning expected JSON, not just a 200 OK.";
                }

                $mailable = new WeeklyUptimeReportEmail($user);
                // Dynamically inject data since we are using view parameters
                $mailable->with([
                    'industryNews' => $industryNews,
                    'featureSpotlight' => $featureSpotlight,
                    'educationalTip' => $educationalTip,
                ]);

                Mail::to($user->email)->send($mailable);

                EmailDelivery::create([
                    'user_id' => $user->id,
                    'event_name' => 'weekly_newsletter',
                    'email' => $user->email,
                    'status' => 'sent',
                    'sent_at' => now()
                ]);
            }
        });

        $this->info('Weekly newsletter dispatched successfully.');
    }
}
