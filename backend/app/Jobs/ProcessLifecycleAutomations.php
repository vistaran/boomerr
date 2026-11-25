<?php

namespace App\Jobs;

use App\Models\User;
use App\Models\EmailDelivery;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;
use Illuminate\Mail\Mailable;
use App\Models\EmailTemplate;
use App\Mail\Onboarding\WelcomeEmail;
use App\Mail\Onboarding\AddFirstMonitorEmail;
use App\Mail\Onboarding\ConfigureAlertsEmail;
use App\Mail\Onboarding\SetupAdPauseEmail;
use App\Mail\Onboarding\AddTeamEmail;
use App\Mail\Onboarding\ReviewDashboardEmail;
use App\Mail\Onboarding\UpgradeCtaEmail;
use App\Models\NotificationChannel;
use App\Mail\Lifecycle\TrialValueSummaryEmail;
use App\Mail\Lifecycle\TrialCaseStudyEmail;
use App\Mail\Lifecycle\TrialOfferEmail;
use App\Mail\Lifecycle\CheckDashboardEmail;
use App\Mail\Lifecycle\FeatureHighlightEmail;
use App\Mail\Lifecycle\FounderOutreachEmail;
use App\Mail\Lifecycle\MonitorsStillRunningEmail;
use App\Mail\Lifecycle\NewFeatureAnnouncementEmail;
use App\Mail\Lifecycle\WinBackOfferEmail;
use App\Services\LifecycleEventService;

use App\Mail\Lifecycle\MonitorLimitReachedEmail;

class ProcessLifecycleAutomations implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public ?User $targetUser;

    public function __construct(?User $user = null)
    {
        $this->targetUser = $user;
    }

    /**
     * @var \Illuminate\Support\Collection<string, EmailTemplate>
     */
    private $cachedTemplates;

    public function handle()
    {
        Log::info("Starting ProcessLifecycleAutomations job");

        // Preload all email templates into memory once, keyed by their unique key to eliminate N+1 queries
        $this->cachedTemplates = EmailTemplate::all()->keyBy('key');

        if ($this->targetUser) {
            $this->processUser($this->targetUser);
        } else {
            User::with(['workspaces.domains', 'workspaces.integrations'])
                ->orderBy('id')
                ->chunk(100, function ($users) {
                    foreach ($users as $user) {
                        $this->processUser($user);
                    }
                });
        }
    }

    private function getTemplate(string $key): ?EmailTemplate
    {
        if ($this->cachedTemplates === null) {
            $this->cachedTemplates = EmailTemplate::all()->keyBy('key');
        }
        return $this->cachedTemplates->get($key);
    }

    private function processUser(User $user)
    {
        $this->processOnboardingSequence($user);
        $this->processValueSummarySequence($user);

        // Billing-related sequences only run when billing is enabled
        if (config('billing.enabled', false)) {
            $this->processTrialEndingSequence($user);
            $this->processChurnPreventionSequence($user);
            $this->processMonitorLimitCheck($user);
        }

        $this->processEngagementSequence($user);

        // Behavioral
        $this->processBehavioralTriggers($user);

        // Dynamic custom sequence steps added by administrators
        $this->processCustomSequenceSteps($user);
    }

    private function processOnboardingSequence(User $user)
    {
        if (!$user->receives_onboarding_emails)
            return;

        $workspace = $user->currentWorkspace();
        $lifecycleService = app(LifecycleEventService::class);
        $hasCompletedOnboarding = $lifecycleService->hasTriggered($user, 'onboarding_completed');

        // Step 1: Welcome & Add First Domain (sent upon signup / onboarding completion respecting configured delay & active state)
        $welcomeTpl = $this->getTemplate('onboarding_email_1_welcome');
        if ($welcomeTpl ? $welcomeTpl->is_active : true) {
            $welcomeDelayHours = $welcomeTpl ? $welcomeTpl->getDelayInHours() : 0;
            $hoursSinceSignup = $user->created_at ? $user->created_at->diffInHours(now()) : 0;
            if (($hasCompletedOnboarding || $user->email_verified_at) && $hoursSinceSignup >= $welcomeDelayHours && !$this->hasReceivedEmail($user, 'onboarding_email_1_welcome')) {
                $this->queueEmail($user, 'onboarding_email_1_welcome', new WelcomeEmail($user));
            }
        }

        // Step 2: Add First Monitor Reminder (if user has not added any domain yet)
        $addMonTpl = $this->getTemplate('onboarding_email_2_add_monitor');
        if ($addMonTpl ? $addMonTpl->is_active : true) {
            $addMonDelayHours = $addMonTpl ? $addMonTpl->getDelayInHours() : 24; // default 1 day / 24 hours
            $hoursSinceSignup = $user->created_at ? $user->created_at->diffInHours(now()) : 0;
            $hasAnyDomain = $workspace && $workspace->domains()->exists();
            if (!$hasAnyDomain && $hoursSinceSignup >= $addMonDelayHours && !$this->hasReceivedEmail($user, 'onboarding_email_2_add_monitor')) {
                $this->queueEmail($user, 'onboarding_email_2_add_monitor', new AddFirstMonitorEmail($user));
            }
        }

        if (!$workspace)
            return;

        $firstDomain = $workspace->domains()->orderBy('created_at', 'asc')->first();
        if (!$firstDomain)
            return;

        $hasAlerts = NotificationChannel::where('workspace_id', $workspace->id)->exists();
        $hasAdsIntegration = $workspace->integrations()->whereIn('integrations.key', ['google_ads', 'facebook_ads'])->exists();
        $hasTeam = $workspace->users()->count() > 1;
        $hasActiveSub = method_exists($workspace, 'activeSubscription') && $workspace->activeSubscription()->exists();

        $hoursSinceFirstDomain = $firstDomain->created_at->diffInHours(now());

        // Step 3: Configure Alerts (default: 1 hour after adding first domain)
        $alertTpl = $this->getTemplate('onboarding_email_3_configure_alerts');
        if ($alertTpl ? $alertTpl->is_active : true) {
            $alertDelayHours = $alertTpl ? $alertTpl->getDelayInHours() : 1;
            if ($hoursSinceFirstDomain >= $alertDelayHours && !$hasAlerts && !$this->hasReceivedEmail($user, 'onboarding_email_3_configure_alerts')) {
                $this->queueEmail($user, 'onboarding_email_3_configure_alerts', new ConfigureAlertsEmail($user));
            }
        }

        // Step 4: Setup Ad Pause (default: 1 week / 168 hours after adding first domain)
        $adTpl = $this->getTemplate('onboarding_email_4_ad_pause');
        if ($adTpl ? $adTpl->is_active : true) {
            $adDelayHours = $adTpl ? $adTpl->getDelayInHours() : 168;
            if ($hoursSinceFirstDomain >= $adDelayHours && !$hasAdsIntegration && !$this->hasReceivedEmail($user, 'onboarding_email_4_ad_pause')) {
                $this->queueEmail($user, 'onboarding_email_4_ad_pause', new SetupAdPauseEmail($user));
            }
        }

        // Step 5: Add Team (default: 2 days / 48 hours after adding first domain)
        $teamTpl = $this->getTemplate('onboarding_email_5_add_team');
        if ($teamTpl ? $teamTpl->is_active : true) {
            $teamDelayHours = $teamTpl ? $teamTpl->getDelayInHours() : 48;
            if ($hoursSinceFirstDomain >= $teamDelayHours && !$hasTeam && !$this->hasReceivedEmail($user, 'onboarding_email_5_add_team')) {
                $this->queueEmail($user, 'onboarding_email_5_add_team', new AddTeamEmail($user));
            }
        }

        // Step 6: Review Dashboard & Metrics (default: 3 days / 72 hours after adding first domain)
        $reviewTpl = $this->getTemplate('onboarding_email_6_review_dashboard');
        if ($reviewTpl ? $reviewTpl->is_active : true) {
            $reviewDelayHours = $reviewTpl ? $reviewTpl->getDelayInHours() : 72;
            if ($hoursSinceFirstDomain >= $reviewDelayHours && !$this->hasReceivedEmail($user, 'onboarding_email_6_review_dashboard')) {
                $this->queueEmail($user, 'onboarding_email_6_review_dashboard', new ReviewDashboardEmail($user));
            }
        }

        // Step 7: Upgrade CTA (default: 1 month / 720 hours after adding first domain)
        $upgradeTpl = $this->getTemplate('onboarding_email_7_upgrade_cta');
        if ($upgradeTpl ? $upgradeTpl->is_active : true) {
            $upgradeDelayHours = $upgradeTpl ? $upgradeTpl->getDelayInHours() : 720;
            if ($hoursSinceFirstDomain >= $upgradeDelayHours && !$hasActiveSub && !$this->hasReceivedEmail($user, 'onboarding_email_7_upgrade_cta')) {
                $this->queueEmail($user, 'onboarding_email_7_upgrade_cta', new UpgradeCtaEmail($user));
            }
        }
    }

    private function processValueSummarySequence(User $user)
    {
        if (!$user->receives_promotional_emails)
            return;

        $valTpl = $this->getTemplate('trial_email_1_value_summary');
        if ($valTpl ? $valTpl->is_active : true) {
            $valDelayHours = $valTpl ? $valTpl->getDelayInHours() : 336; // default 2 weeks / 14 days
            $hoursSinceSignup = $user->created_at ? $user->created_at->diffInHours(now()) : 0;

            if ($hoursSinceSignup >= $valDelayHours && !$this->hasReceivedEmail($user, 'trial_email_1_value_summary')) {
                $this->queueEmail($user, 'trial_email_1_value_summary', new TrialValueSummaryEmail($user));
            }
        }
    }

    private function processTrialEndingSequence(User $user)
    {
        if (!$user->receives_promotional_emails)
            return;

        $workspace = $user->currentWorkspace();
        $hasActiveSub = $workspace && method_exists($workspace, 'activeSubscription') && $workspace->activeSubscription()->exists();
        if ($hasActiveSub)
            return;

        $hoursSinceSignup = $user->created_at ? $user->created_at->diffInHours(now()) : 0;

        // Step 2 of trial: Case Study
        $caseStudyTpl = $this->getTemplate('trial_email_2_case_study');
        if ($caseStudyTpl ? $caseStudyTpl->is_active : true) {
            $delayHours = $caseStudyTpl ? $caseStudyTpl->getDelayInHours() : 120; // 5 days default
            $triggerEvent = $caseStudyTpl ? $caseStudyTpl->trigger_event : 'signup';

            $shouldTrigger = false;
            if ($triggerEvent === 'signup') {
                $shouldTrigger = ($hoursSinceSignup >= $delayHours);
            } elseif ($workspace && $workspace->trial_ends_at) {
                $daysUntilExpiration = now()->diffInDays($workspace->trial_ends_at, false);
                $shouldTrigger = ($daysUntilExpiration <= max(1, (int) round($delayHours / 24)));
            }

            if ($shouldTrigger && !$this->hasReceivedEmail($user, 'trial_email_2_case_study')) {
                $this->queueEmail($user, 'trial_email_2_case_study', new TrialCaseStudyEmail($user));
            }
        }

        // Step 3 of trial: Special Offer
        $offerTpl = $this->getTemplate('trial_email_3_offer');
        if ($offerTpl ? $offerTpl->is_active : true) {
            $delayHours = $offerTpl ? $offerTpl->getDelayInHours() : 240; // 10 days default
            $triggerEvent = $offerTpl ? $offerTpl->trigger_event : 'signup';

            $shouldTrigger = false;
            if ($triggerEvent === 'signup') {
                $shouldTrigger = ($hoursSinceSignup >= $delayHours);
            } elseif ($workspace && $workspace->trial_ends_at) {
                $daysUntilExpiration = now()->diffInDays($workspace->trial_ends_at, false);
                $shouldTrigger = ($daysUntilExpiration <= 0 && $daysUntilExpiration >= -2);
            }

            if ($shouldTrigger && !$this->hasReceivedEmail($user, 'trial_email_3_offer')) {
                $this->queueEmail($user, 'trial_email_3_offer', new TrialOfferEmail($user));
            }
        }
    }

    private function processChurnPreventionSequence(User $user)
    {
        if (!$user->receives_product_updates)
            return;

        $workspace = $user->currentWorkspace();
        $hasActiveMonitors = $workspace && $workspace->domains()->where('is_active', true)->exists();
        $hoursSinceLogin = $user->last_login_at ? $user->last_login_at->diffInHours(now()) : ($user->created_at ? $user->created_at->diffInHours(now()) : 0);

        // Step 1: Your monitors are still running but you haven't checked in (default: 1 week / 168 hours)
        $runningTpl = $this->getTemplate('reactivation_email_1_running');
        if ($runningTpl ? $runningTpl->is_active : true) {
            $checkinDelayHours = $runningTpl ? $runningTpl->getDelayInHours() : 168; // 1 week
            if ($hoursSinceLogin >= $checkinDelayHours && $hasActiveMonitors && !$this->hasReceivedEmail($user, 'reactivation_email_1_running')) {
                $this->queueEmail($user, 'reactivation_email_1_running', new MonitorsStillRunningEmail($user));
            }
        }

        // Step 2: Feature Highlight (default: 2 weeks / 336 hours)
        $highlightTpl = $this->getTemplate('churn_email_2_highlight');
        if ($highlightTpl ? $highlightTpl->is_active : true) {
            $highlightDelayHours = $highlightTpl ? $highlightTpl->getDelayInHours() : 336;
            if ($hoursSinceLogin >= $highlightDelayHours && !$this->hasReceivedEmail($user, 'churn_email_2_highlight')) {
                $this->queueEmail($user, 'churn_email_2_highlight', new FeatureHighlightEmail($user));
            }
        }

        // Step 3: Direct Founder Outreach (default: 3 weeks / 504 hours)
        $founderTpl = $this->getTemplate('churn_email_3_founder');
        if ($founderTpl ? $founderTpl->is_active : true) {
            $founderDelayHours = $founderTpl ? $founderTpl->getDelayInHours() : 504;
            if ($hoursSinceLogin >= $founderDelayHours && !$this->hasReceivedEmail($user, 'churn_email_3_founder')) {
                $this->queueEmail($user, 'churn_email_3_founder', new FounderOutreachEmail($user));
            }
        }

        // Step 4: Win-Back Offer (default: 4 weeks / 672 hours)
        $winBackTpl = $this->getTemplate('win_back_offer');
        if ($winBackTpl ? $winBackTpl->is_active : true) {
            $winBackDelayHours = $winBackTpl ? $winBackTpl->getDelayInHours() : 672;
            if ($hoursSinceLogin >= $winBackDelayHours && !$this->hasReceivedEmail($user, 'win_back_offer')) {
                $this->queueEmail($user, 'win_back_offer', new WinBackOfferEmail($user));
            }
        }
    }

    private function processEngagementSequence(User $user)
    {
        if (!$user->receives_product_updates)
            return;

        $hoursSinceLogin = $user->last_login_at ? $user->last_login_at->diffInHours(now()) : ($user->created_at ? $user->created_at->diffInHours(now()) : 0);

        $checkDashTpl = $this->getTemplate('check_dashboard');
        if ($checkDashTpl ? $checkDashTpl->is_active : true) {
            $delayHours = $checkDashTpl ? $checkDashTpl->getDelayInHours() : 168; // 1 week
            if ($hoursSinceLogin >= $delayHours && !$this->hasReceivedEmail($user, 'check_dashboard')) {
                $this->queueEmail($user, 'check_dashboard', new CheckDashboardEmail($user));
            }
        }
    }

    private function processMonitorLimitCheck(User $user)
    {
        $limitTpl = $this->getTemplate('monitor_limit_reached');
        if ($limitTpl && !$limitTpl->is_active) {
            return;
        }

        $workspace = $user->currentWorkspace();
        if (!$workspace)
            return;

        $maxAllowed = 5; // Free plan default
        if (method_exists($workspace, 'activePlan') && $workspace->activePlan()) {
            $maxAllowed = $workspace->activePlan()->max_domains ?? 5;
        }

        if ($workspace->domains()->count() >= $maxAllowed && !$this->hasReceivedEmail($user, 'monitor_limit_reached')) {
            $this->queueEmail($user, 'monitor_limit_reached', new MonitorLimitReachedEmail($user));
        }
    }

    private function processCustomSequenceSteps(User $user)
    {
        $knownKeys = [
            'onboarding_email_1_welcome',
            'onboarding_email_2_add_monitor',
            'onboarding_email_3_configure_alerts',
            'onboarding_email_4_ad_pause',
            'onboarding_email_5_add_team',
            'onboarding_email_6_review_dashboard',
            'onboarding_email_7_upgrade_cta',
            'trial_email_1_value_summary',
            'trial_email_2_case_study',
            'trial_email_3_offer',
            'reactivation_email_1_running',
            'churn_email_2_highlight',
            'churn_email_3_founder',
            'win_back_offer',
            'check_dashboard',
            'monitor_limit_reached',
            'behavioral_missing_alerts',
            'behavioral_missing_ad_pause',
            'behavioral_pending_invite',
        ];

        $customTemplates = ($this->cachedTemplates ?: EmailTemplate::all()->keyBy('key'))
            ->filter(function ($tpl) use ($knownKeys) {
                return !empty($tpl->sequence_name) && $tpl->is_active && !in_array($tpl->key, $knownKeys);
            })
            ->sortBy('step_order');

        if ($customTemplates->isEmpty()) {
            return;
        }

        $workspace = $user->currentWorkspace();
        $firstDomain = $workspace ? $workspace->domains()->orderBy('created_at', 'asc')->first() : null;
        $hoursSinceSignup = $user->created_at ? $user->created_at->diffInHours(now()) : 0;
        $hoursSinceLogin = $user->last_login_at ? $user->last_login_at->diffInHours(now()) : $hoursSinceSignup;

        foreach ($customTemplates as $customTpl) {
            if ($this->hasReceivedEmail($user, $customTpl->key)) {
                continue;
            }

            $delayHours = $customTpl->getDelayInHours();
            $shouldTrigger = false;

            switch ($customTpl->trigger_event) {
                case 'signup':
                    $shouldTrigger = ($hoursSinceSignup >= $delayHours);
                    break;

                case 'first_domain_added':
                    if ($firstDomain) {
                        $hoursSinceFirstDomain = $firstDomain->created_at->diffInHours(now());
                        $shouldTrigger = ($hoursSinceFirstDomain >= $delayHours);
                    }
                    break;

                case 'last_login':
                    $shouldTrigger = ($hoursSinceLogin >= $delayHours);
                    break;

                case 'monitor_limit_reached':
                    if ($workspace) {
                        $maxAllowed = (method_exists($workspace, 'activePlan') && $workspace->activePlan())
                            ? ($workspace->activePlan()->max_domains ?? 5)
                            : 5;
                        $shouldTrigger = ($workspace->domains()->count() >= $maxAllowed);
                    }
                    break;

                case 'manual':
                    $shouldTrigger = false;
                    break;

                default:
                    $shouldTrigger = ($hoursSinceSignup >= $delayHours);
                    break;
            }

            if ($shouldTrigger) {
                $this->queueCustomEmail($user, $customTpl);
            }
        }
    }

    private function queueCustomEmail(User $user, EmailTemplate $template)
    {
        $delivery = EmailDelivery::create([
            'user_id' => $user->id,
            'event_name' => $template->key,
            'email' => $user->email,
            'status' => 'queued',
        ]);

        if (!$template->is_active) {
            $delivery->update(['status' => 'skipped']);
            return;
        }

        $data = [
            'firstName' => explode(' ', $user->name)[0] ?? 'there',
            'user' => $user,
            'unsubscribeUrl' => (config('app.frontend_url') ?? config('app.url')) . '/email-preferences',
        ];

        try {
            $renderedSubject = $template->renderSubject($data);
            $renderedHtml = $template->render($data);

            Mail::html($renderedHtml, function ($message) use ($user, $renderedSubject) {
                $message->to($user->email)
                    ->subject($renderedSubject);
            });

            $delivery->update(['status' => 'sent', 'sent_at' => now()]);
        } catch (\Throwable $e) {
            Log::error("Failed to render and send custom sequence email [{$template->key}]: " . $e->getMessage());
            $delivery->update(['status' => 'failed']);
        }
    }

    private function processBehavioralTriggers(User $user)
    {
        if (!$user->receives_product_updates)
            return;
        $workspace = $user->currentWorkspace();
        if (!$workspace)
            return;

        // 1. Added monitor but didn't configure alerts (Wait 12 hrs instead of daily cron if possible, but cron catches it here)
        $hasMonitors = $workspace->domains()->exists();
        $hasAlerts = NotificationChannel::where('workspace_id', $workspace->id)->exists();
        $firstMonitor = $workspace->domains()->orderBy('created_at', 'asc')->first();

        if ($firstMonitor && $firstMonitor->created_at->diffInHours(now()) >= 12 && !$hasAlerts && !$this->hasReceivedEmail($user, 'behavioral_missing_alerts')) {
            $this->queueEmail($user, 'behavioral_missing_alerts', new ConfigureAlertsEmail($user));
        }

        // 2. Has Google Ads enabled but ad-pause not configured
        $hasAdsIntegration = $workspace->integrations()->whereIn('integrations.key', ['google_ads', 'facebook_ads'])->exists();
        if ($hasMonitors && !$hasAdsIntegration && $firstMonitor && $firstMonitor->created_at->diffInDays(now()) >= 3 && !$this->hasReceivedEmail($user, 'behavioral_missing_ad_pause')) {
            $this->queueEmail($user, 'behavioral_missing_ad_pause', new SetupAdPauseEmail($user));
        }

        // 3. Team member invited but hasn't accepted (Re-invite + team value prop)
        // Note: For simplicity we send this to the workspace owner/admin (the current user) to remind them, or we could email the invitee.
        // The requirements say "Team member invited but hasn't accepted -> Re-invite + team value prop". We will send the AddTeamEmail to the owner as a nudge to re-invite them.
        $hasPendingInvites = \App\Models\TeamInvitation::where('workspace_id', $workspace->id)
            ->where('created_at', '<=', now()->subDays(3))
            ->exists();

        if ($hasPendingInvites && !$this->hasReceivedEmail($user, 'behavioral_pending_invite')) {
            $this->queueEmail($user, 'behavioral_pending_invite', new AddTeamEmail($user));
        }
    }

    private function hasReceivedEmail(User $user, string $eventName): bool
    {
        return EmailDelivery::where('user_id', $user->id)
            ->where('event_name', $eventName)
            ->exists();
    }

    private function queueEmail(User $user, string $eventName, Mailable $mailable)
    {
        $delivery = EmailDelivery::create([
            'user_id' => $user->id,
            'event_name' => $eventName,
            'email' => $user->email,
            'status' => 'queued',
        ]);

        // Map behavioral event aliases to their corresponding template key
        $templateKey = match ($eventName) {
            'behavioral_missing_alerts' => 'onboarding_email_3_configure_alerts',
            'behavioral_missing_ad_pause' => 'onboarding_email_4_ad_pause',
            'behavioral_pending_invite' => 'onboarding_email_5_add_team',
            default => $eventName,
        };

        // Check if template exists in database
        $dbTemplate = $this->getTemplate($templateKey);

        // If template exists and is deactivated by admin, skip sending
        if ($dbTemplate && !$dbTemplate->is_active) {
            $delivery->update(['status' => 'skipped']);
            Log::info("Skipping email for {$templateKey} because template is deactivated by admin.");
            return;
        }

        if ($dbTemplate) {
            $data = [
                'firstName' => explode(' ', $user->name)[0] ?? 'there',
                'user' => $user,
                'unsubscribeUrl' => (config('app.frontend_url') ?? config('app.url')) . '/email-preferences',
            ];

            try {
                $renderedSubject = $dbTemplate->renderSubject($data);
                $renderedHtml = $dbTemplate->render($data);

                Mail::html($renderedHtml, function ($message) use ($user, $renderedSubject) {
                    $message->to($user->email)
                        ->subject($renderedSubject);
                });

                $delivery->update(['status' => 'sent', 'sent_at' => now()]);
                return;
            } catch (\Throwable $e) {
                Log::warning("Failed rendering DB template for {$templateKey}, falling back to static mailable: " . $e->getMessage());
            }
        }

        Mail::to($user->email)->send($mailable);
        $delivery->update(['status' => 'sent', 'sent_at' => now()]);
    }
}