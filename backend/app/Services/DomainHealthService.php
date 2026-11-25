<?php

namespace App\Services;

use App\Enums\SystemLogEventType;
use App\Models\DomainIntegration;
use App\Models\Integration;
use App\Models\SystemLog;
use App\Services\IncidentRecorderService;
use App\Services\Logging\ActionLogHandle;
use App\Events\DomainStatusUpdated;
use App\Models\Domain;
use App\Models\DomainStatusEvent;
use App\Models\Incident;
use App\Models\NotificationChannel;
use App\Models\User;
use App\Notifications\DomainDownNotification;
use App\Notifications\DomainNewIncidentNotification;
use App\Notifications\DomainSslExpiringNotification;
use App\Notifications\DomainUpNotification;
use App\Jobs\SendSmsAlertJob;
use App\Jobs\SendWhatsAppAlertJob;
use App\Models\SmsNotificationSetting;
use App\Models\WhatsappNotificationSetting;
use App\Models\WorkspaceIntegration;
use App\Services\DiscordNotifier;
use App\Services\SlackNotifier;
use App\Services\SystemLogService;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;
use Illuminate\Support\Str;
use Throwable;

class DomainHealthService
{
    /**
     * The incident recorder service instance.
     * @var IncidentRecorderService|null
     */
    protected $incidentRecorder;

    /** @var array<string, int|null> */
    private array $integrationCache = [];

    /** @var array<int, array> */
    private array $linkageCache = [];

    public function __construct(private readonly SystemLogService $systemLogs, IncidentRecorderService $incidentRecorder)
    {
        $this->incidentRecorder = $incidentRecorder;
    }



    public function setIncidentRecorder(IncidentRecorderService $recorder)
    {
        $this->incidentRecorder = $recorder;
    }

    // public function __construct(
    //     private PlivoService $plivoService
    // ) {}

    public function runFullHealthCheck(Domain $domain, bool $suppressStatusNotification = false): Domain
    {
        $this->runUptimeCheck($domain, $suppressStatusNotification);
        $domain->refresh();
        $this->runSslCheck($domain);
        $domain->refresh();

        try {
            app(\App\Services\WhoisService::class)->updateDomainExpiration($domain);
            $domain->refresh();
        } catch (Throwable $e) {
            Log::warning('Initial WHOIS check failed', ['domain_id' => $domain->id, 'error' => $e->getMessage()]);
        }

        return $domain;
    }

    public function runUptimeCheck(Domain $domain, bool $suppressStatusNotification = false): void
    {
        if (!\App\Services\PlanLimitService::isDomainEligibleForMonitoring($domain)) {
            return;
        }

        $oldErrorStatus = $domain->last_response_status;
        $oldDomainStatus = $domain->status;
        $startedAt = microtime(true);
        $httpStatus = null;
        $failureReason = null;
        $linkage = $this->resolveDomainIntegrationLinkage($domain);
        $linkedDomainIntegrationId = $linkage['domain_integration_id'];
        $linkedIntegrationId = $linkage['integration_id'];
        $linkedNotificationChannelId = $linkage['notification_channel_id'];

        // SSRF Guard: Verify domain URL resolves to a safe, public IP
        $ssrfReason = null;
        if (!\App\Helpers\SecurityHelper::isSafeUrl($domain->url, $ssrfReason)) {
            Log::warning("SSRF Protection: Domain #{$domain->id} check aborted", [
                'domain_id' => $domain->id,
                'url' => $domain->url,
                'reason' => $ssrfReason,
            ]);

            $domain->status = 'down';
            $domain->last_response_time_ms = null;
            $domain->last_response_status = 'Blocked: Private/Reserved Address';
            $domain->last_checked_at = now();
            $domain->save();
            return;
        }

        $isResponseSuccessful = false;
        try {
            $timeout = (int) config('monitoring.http_timeout', 20);
            $safeResult = \App\Helpers\SecurityHelper::executeSafeRequest($domain->url, [
                'method' => 'GET',
                'timeout' => $timeout,
                'max_redirects' => 5,
                'verify_ssl' => false,
            ]);

            $httpStatus = $safeResult['http_code'];
            $durationMs = $safeResult['total_time_ms'];
            $domain->last_response_status = $httpStatus ?: ($safeResult['error'] ?? 'Connection Failed');
            $isResponseSuccessful = ($httpStatus >= 200 && $httpStatus < 400);

            if ($isResponseSuccessful) {
                $domain->status = 'up';
                $domain->last_response_time_ms = $durationMs;
            } else {
                $domain->status = 'down';
                $domain->last_response_time_ms = null;
                $failureReason = sprintf('HTTP %s %s', $httpStatus, $safeResult['error'] ?? 'Error');
                Log::warning('Domain responded with error status', [
                    'domain_id' => $domain->id,
                    'http_status' => $httpStatus,
                ]);
            }
        } catch (Throwable $e) {
            $isResponseSuccessful = false;
            $domain->status = 'down';
            $domain->last_response_time_ms = null;
            $failureReason = $e->getMessage();
            $domain->last_response_status = $e->getMessage();

            Log::error('Domain check failed', [
                'domain_id' => $domain->id,
                'error' => $e->getMessage(),
            ]);
        }

        if (!$isResponseSuccessful && $oldDomainStatus !== 'down') {
            // False DOWN protection: Check #1 detected failure when domain was UP.
            // Initiate 3-check confirmation mechanism. Keep domain UP until confirmed.
            $confirmationKey = "domain_down_confirmation_{$domain->id}";
            if (!\Illuminate\Support\Facades\Cache::has($confirmationKey)) {
                \Illuminate\Support\Facades\Cache::put($confirmationKey, true, 60);
                \App\Jobs\ProcessUptimeConfirmationJob::dispatch(
                    $domain->id,
                    2,
                    $httpStatus,
                    $failureReason,
                    'local',
                    'local',
                    'Local'
                )->delay(now()->addSeconds(2));

                Log::warning("Initial uptime check #1 failed for domain #{$domain->id} ({$domain->url}). Dispatched Confirmation Check #2 in 2s. Domain remains UP.", [
                    'domain_id' => $domain->id,
                    'http_status' => $httpStatus,
                    'failure_reason' => $failureReason,
                ]);
            }

            $domain->status = $oldDomainStatus ?? 'up';
            $domain->last_checked_at = \Illuminate\Support\Carbon::now();
            $domain->save();
            return;
        }

        $domain->last_checked_at = \Illuminate\Support\Carbon::now();
        $domain->save();
        $domain->refresh();

        $errorStatusChanged = $oldErrorStatus !== $domain->last_response_status;
        $domainStatusChanged = $oldDomainStatus !== $domain->status;
        $oldStatus = $oldDomainStatus;

        // Incident logic
        $incident = null;
        $shouldNotifyErrorStatusChange = false;
        if ((($errorStatusChanged || $domainStatusChanged) || (!$isResponseSuccessful && $this->incidentRecorder)) && $this->incidentRecorder) {
            // Check latest ongoing incident for this domain
            $latestIncident = Incident::where('domain_id', $domain->id)
                ->where('status', 'ongoing')
                ->orderByDesc('started_at')
                ->first();

            // If status changes from up to down, or error status changes while still down
            if ($domain->status === 'down') {
                $shouldCreateNewIncident = false;

                if ($errorStatusChanged) {
                    $shouldNotifyErrorStatusChange = true;
                }

                // If there is no ongoing incident, create new
                if (!$latestIncident) {
                    $shouldCreateNewIncident = true;
                    $shouldNotifyErrorStatusChange = true;
                } else {
                    // Ongoing incident continues. Do not resolve and recreate on error string fluctuations.
                    $shouldCreateNewIncident = false;
                    $shouldNotifyErrorStatusChange = false;
                }

                if ($shouldCreateNewIncident) {
                    $extraHeaders = [
                        'http_status' => isset($response) ? $response->status() : null,
                        'checked_at' => now()->toDateTimeString(),
                        'response_headers' => isset($response) ? $response->headers() : null,
                        'response_body' => isset($response) ? (is_string($response->body()) ? mb_substr($response->body(), 0, 2048) : null) : null,
                        'duration_ms' => isset($durationMs) ? $durationMs : null,
                        'exception' => !isset($response) ? ($domain->last_response_status ?? null) : null,
                    ];
                    $incident = $this->incidentRecorder->recordIncident($domain, $extraHeaders);
                } else {
                    $incident = $latestIncident;
                }
            }
            // If status changes from down to up, mark ongoing incident as resolved
            elseif ($oldDomainStatus === 'down' && $domain->status === 'up') {
                if (!$latestIncident) {
                    $latestIncident = Incident::where('domain_id', $domain->id)
                        ->orderByDesc('id')
                        ->first();
                }

                if ($latestIncident) {
                    if ($latestIncident->status !== 'resolved') {
                        $latestIncident->status = 'resolved';
                        $latestIncident->resolved_at = now();
                        $latestIncident->save();
                    }
                    $incident = $latestIncident;
                }
            }
        }
        // Record status event for analytics (with response time when available)
        try {
            $region = env('AWS_DEFAULT_REGION', 'ap-south-1');
            $location = \App\Services\MonitoringService::getLocationFromRegion($region);

            DomainStatusEvent::create([
                'domain_id' => $domain->id,
                'status' => $domain->status ?? 'unknown',
                'response_time_ms' => $domain->last_response_time_ms,
                'incident_id' => $incident->id ?? null,
                'check_source' => 'system',
                'checked_at' => now(),
                'http_status' => $httpStatus ?? null,
                'region' => $region,
                'location' => $location,
            ]);
        } catch (Throwable $e) {
            Log::warning('Failed to record domain status event', [
                'domain_id' => $domain->id,
                'error' => $e->getMessage(),
            ]);
        }

        $statusChanged = $oldStatus !== $domain->status;
        $shouldCreateActionLog = ($statusChanged && $oldStatus !== null)
            || ($shouldNotifyErrorStatusChange && !$domainStatusChanged && !$suppressStatusNotification && !$domain->isFirstHealthCheck());

        // Create parent action log for status change or new incident (will contain integration child logs)
        $actionHandle = null;
        if ($shouldCreateActionLog) {
            $actionMessage = $statusChanged
                ? ($domain->status === 'up' ? 'Domain is UP' : ($failureReason ? 'Domain is DOWN: ' . $failureReason : 'Domain is DOWN'))
                : ($incident ? "🚨 New Incident: {$domain->name}" : ($failureReason ? "Domain is DOWN: {$failureReason}" : "Domain is DOWN"));

            $actionHandle = $this->systemLogs->beginAction([
                'workspace_id' => $domain->workspace_id,
                'domain_id' => $domain->id,
                'incident_id' => $incident?->id,
                'event_type' => SystemLogEventType::DOMAIN_UPTIME,
                'source' => 'health-checker',
                'category' => 'monitoring.uptime',
                'trigger_source' => 'uptime-monitor',
                'message' => $actionMessage,
                'response_time_ms' => $domain->last_response_time_ms,
                'error_message' => $domain->status === 'down' ? ($failureReason ?? 'Domain unreachable') : null,
                'payload' => [
                    'old_status' => $oldStatus,
                    'new_status' => $domain->status,
                    'http_status' => $httpStatus,
                    'url' => $domain->url,
                    'status_changed' => $statusChanged,
                    'incident_ulid' => $incident?->ulid,
                ],
                'actor' => $this->systemLogs->automationActor('health-checker'),
            ]);
        }

        // SMS + WhatsApp UP alerts when domain recovers - must run BEFORE trackDownAlerts
        // because trackDownAlerts resets consecutive_down_alert_count to 0 on success.
        if ($isResponseSuccessful && $oldDomainStatus === 'down') {
            try {
                $this->trackUpAlerts($domain, $actionHandle);
            } catch (Throwable $e) {
                Log::error('trackUpAlerts threw unexpectedly - health check continued', [
                    'domain_id' => $domain->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        // SMS + WhatsApp failure tracking for domain down alerts (combined - single increment)
        try {
            $this->trackDownAlerts($domain, $isResponseSuccessful, $actionHandle);
        } catch (Throwable $e) {
            Log::error('trackDownAlerts threw unexpectedly - health check continued', [
                'domain_id' => $domain->id,
                'error' => $e->getMessage(),
            ]);
        }

        // Skip notifications and broadcasts on first health check
        if (
            $shouldNotifyErrorStatusChange &&
            !$domainStatusChanged &&
            !$suppressStatusNotification &&
            !$domain->isFirstHealthCheck()
        ) {
            $this->notifyOnNewIncident($domain, $incident, $actionHandle);
        }

        // Skip notifications and broadcasts on first health check
        if (
            $domainStatusChanged &&
            !$suppressStatusNotification &&
            !$domain->isFirstHealthCheck()
        ) {
            $this->notifyOnStatusChange($domain, $oldDomainStatus, $incident, $actionHandle);
        }

        // Mark the action as complete after all integrations have been notified
        if ($actionHandle) {
            $finalStatus = $domain->status === 'up'
                ? SystemLog::EXECUTION_SUCCESS
                : SystemLog::EXECUTION_FAILURE;

            $actionHandle->markComplete($finalStatus, [
                'domain_status' => $domain->status,
                'response_time_ms' => $domain->last_response_time_ms,
            ]);
        }

        if (
            !$suppressStatusNotification &&
            !$domain->isFirstHealthCheck()
        ) {
            DomainStatusUpdated::dispatch($domain, $domainStatusChanged, $actionHandle?->getParentId());
        }
    }

    public function processExternalUptimeResult(
        Domain $domain,
        string $status,
        ?int $httpStatus,
        ?string $failureReason,
        ?int $durationMs,
        string $region,
        string $location,
        bool $suppressStatusNotification = false
    ): void {
        if (!\App\Services\PlanLimitService::isDomainEligibleForMonitoring($domain)) {
            return;
        }

        $oldErrorStatus = $domain->last_response_status;
        $oldDomainStatus = $domain->status;

        $linkage = $this->resolveDomainIntegrationLinkage($domain);
        $linkedDomainIntegrationId = $linkage['domain_integration_id'];
        $linkedIntegrationId = $linkage['integration_id'];
        $linkedNotificationChannelId = $linkage['notification_channel_id'];

        $isResponseSuccessful = ($status === 'up');

        if (!$isResponseSuccessful && $oldDomainStatus !== 'down') {
            // False DOWN protection for Lambda: Lambda detected DOWN when domain was UP.
            // Initiate 3-check confirmation mechanism. Keep domain UP until confirmed.
            $confirmationKey = "domain_down_confirmation_{$domain->id}";
            if (!\Illuminate\Support\Facades\Cache::has($confirmationKey)) {
                \Illuminate\Support\Facades\Cache::put($confirmationKey, true, 60);
                \App\Jobs\ProcessUptimeConfirmationJob::dispatch(
                    $domain->id,
                    2,
                    $httpStatus,
                    $failureReason,
                    'lambda',
                    $region,
                    $location
                )->delay(now()->addSeconds(2));

                Log::warning("Lambda uptime check #1 reported DOWN for domain #{$domain->id} ({$domain->url}). Dispatched Confirmation Check #2 in 2s. Domain remains UP.", [
                    'domain_id' => $domain->id,
                    'region' => $region,
                    'http_status' => $httpStatus,
                    'failure_reason' => $failureReason,
                ]);
            }

            $domain->status = $oldDomainStatus ?? 'up';
            $domain->last_checked_at = \Illuminate\Support\Carbon::now();
            $domain->save();
            return;
        }

        if ($isResponseSuccessful) {
            $domain->status = 'up';
            $domain->last_response_status = $httpStatus ?? 200;
            $domain->last_response_time_ms = $durationMs;
        } else {
            $domain->status = 'down';
            $domain->last_response_status = $httpStatus ?? ($failureReason ?? 'unknown');
            $domain->last_response_time_ms = null;
        }

        $domain->last_checked_at = \Illuminate\Support\Carbon::now();
        $domain->save();
        $domain->refresh();

        $errorStatusChanged = $oldErrorStatus !== $domain->last_response_status;
        $domainStatusChanged = $oldDomainStatus !== $domain->status;
        $oldStatus = $oldDomainStatus;

        // Incident logic
        $incident = null;
        $shouldNotifyErrorStatusChange = false;
        if ((($errorStatusChanged || $domainStatusChanged) || (!$isResponseSuccessful && $this->incidentRecorder)) && $this->incidentRecorder) {
            // Check latest ongoing incident for this domain
            $latestIncident = Incident::where('domain_id', $domain->id)
                ->where('status', 'ongoing')
                ->orderByDesc('started_at')
                ->first();

            // If status changes from up to down, or error status changes while still down
            if ($domain->status === 'down') {
                $shouldCreateNewIncident = false;

                if ($errorStatusChanged) {
                    $shouldNotifyErrorStatusChange = true;
                }

                // If there is no ongoing incident, always create new
                if (!$latestIncident) {
                    $shouldCreateNewIncident = true;
                    $shouldNotifyErrorStatusChange = true;
                } else {
                    // Ongoing incident continues. Do not resolve and recreate on error string fluctuations.
                    $shouldCreateNewIncident = false;
                    $shouldNotifyErrorStatusChange = false;
                }

                if ($shouldCreateNewIncident) {
                    $extraHeaders = [
                        'http_status' => $httpStatus,
                        'checked_at' => now()->toDateTimeString(),
                        'response_headers' => null,
                        'response_body' => null,
                        'duration_ms' => $durationMs,
                        'exception' => $failureReason,
                    ];
                    $incident = $this->incidentRecorder->recordIncident($domain, $extraHeaders);
                } else {
                    $incident = $latestIncident;
                }
            }
            // If status changes from down to up, mark ongoing incident as resolved
            elseif ($oldDomainStatus === 'down' && $domain->status === 'up') {
                if (!$latestIncident) {
                    $latestIncident = Incident::where('domain_id', $domain->id)
                        ->orderByDesc('id')
                        ->first();
                }

                if ($latestIncident) {
                    if ($latestIncident->status !== 'resolved') {
                        $latestIncident->status = 'resolved';
                        $latestIncident->resolved_at = now();
                        $latestIncident->save();
                    }
                    $incident = $latestIncident;
                }
            }
        }
        // Link incident_id to recent DomainStatusEvent or create one if not yet recorded
        try {
            $recentEvent = DomainStatusEvent::where('domain_id', $domain->id)
                ->where('region', $region)
                ->latest('id')
                ->first();

            if ($recentEvent) {
                if ($incident && !$recentEvent->incident_id) {
                    $recentEvent->incident_id = $incident->id;
                    $recentEvent->save();
                }
            } else {
                DomainStatusEvent::create([
                    'domain_id' => $domain->id,
                    'status' => $domain->status ?? 'unknown',
                    'response_time_ms' => $domain->last_response_time_ms,
                    'incident_id' => $incident->id ?? null,
                    'check_source' => 'external',
                    'checked_at' => now(),
                    'http_status' => $httpStatus ?? null,
                    'region' => $region,
                    'location' => $location,
                ]);
            }
        } catch (Throwable $e) {
            Log::warning('Failed to record domain status event', [
                'domain_id' => $domain->id,
                'error' => $e->getMessage(),
            ]);
        }

        $statusChanged = $oldStatus !== $domain->status;
        $shouldCreateActionLog = ($statusChanged && $oldStatus !== null)
            || ($shouldNotifyErrorStatusChange && !$domainStatusChanged && !$suppressStatusNotification && !$domain->isFirstHealthCheck());

        // Create parent action log for status change or new incident (will contain integration child logs)
        $actionHandle = null;
        if ($shouldCreateActionLog) {
            $actionMessage = $statusChanged
                ? ($domain->status === 'up' ? 'Domain is UP' : ($failureReason ? 'Domain is DOWN: ' . $failureReason : 'Domain is DOWN'))
                : ($incident ? "🚨 New Incident: {$domain->name}" : ($failureReason ? "Domain is DOWN: {$failureReason}" : "Domain is DOWN"));

            $actionHandle = $this->systemLogs->beginAction([
                'workspace_id' => $domain->workspace_id,
                'domain_id' => $domain->id,
                'incident_id' => $incident?->id,
                'event_type' => SystemLogEventType::DOMAIN_UPTIME,
                'source' => 'external-health-checker',
                'category' => 'monitoring.uptime',
                'trigger_source' => 'external-uptime-monitor',
                'message' => $actionMessage,
                'response_time_ms' => $domain->last_response_time_ms,
                'error_message' => $domain->status === 'down' ? ($failureReason ?? 'Domain unreachable') : null,
                'payload' => [
                    'old_status' => $oldStatus,
                    'new_status' => $domain->status,
                    'http_status' => $httpStatus,
                    'url' => $domain->url,
                    'status_changed' => $statusChanged,
                    'incident_ulid' => $incident?->ulid,
                ],
                'actor' => $this->systemLogs->automationActor('health-checker'),
            ]);
        }

        // SMS + WhatsApp UP alerts when domain recovers - must run BEFORE trackDownAlerts
        // because trackDownAlerts resets consecutive_down_alert_count to 0 on success.
        if ($isResponseSuccessful && $oldDomainStatus === 'down') {
            try {
                $this->trackUpAlerts($domain, $actionHandle);
            } catch (Throwable $e) {
                Log::error('trackUpAlerts threw unexpectedly - health check continued', [
                    'domain_id' => $domain->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        // SMS + WhatsApp failure tracking for domain down alerts (combined - single increment)
        try {
            $this->trackDownAlerts($domain, $isResponseSuccessful, $actionHandle);
        } catch (Throwable $e) {
            Log::error('trackDownAlerts threw unexpectedly - health check continued', [
                'domain_id' => $domain->id,
                'error' => $e->getMessage(),
            ]);
        }

        // Skip notifications and broadcasts on first health check
        if (
            $shouldNotifyErrorStatusChange &&
            !$domainStatusChanged &&
            !$suppressStatusNotification &&
            !$domain->isFirstHealthCheck()
        ) {
            $this->notifyOnNewIncident($domain, $incident, $actionHandle);
        }

        // Skip notifications and broadcasts on first health check
        if (
            $domainStatusChanged &&
            !$suppressStatusNotification &&
            !$domain->isFirstHealthCheck()
        ) {
            $this->notifyOnStatusChange($domain, $oldDomainStatus, $incident, $actionHandle);
        }

        // Mark the action as complete after all integrations have been notified
        if ($actionHandle) {
            $finalStatus = $domain->status === 'up'
                ? SystemLog::EXECUTION_SUCCESS
                : SystemLog::EXECUTION_FAILURE;

            $actionHandle->markComplete($finalStatus, [
                'domain_status' => $domain->status,
                'response_time_ms' => $domain->last_response_time_ms,
            ]);
        }

        if (
            !$suppressStatusNotification &&
            !$domain->isFirstHealthCheck()
        ) {
            DomainStatusUpdated::dispatch($domain, $domainStatusChanged, $actionHandle?->getParentId());
        }
    }

    protected function notifyOnNewIncident(Domain $domain, ?Incident $incident, ?ActionLogHandle $actionHandle = null): void
    {
        if ($domain->consecutive_down_alert_count >= 3) {
            Log::info("Skipping notifyOnNewIncident: consecutive down alert limit (3) reached", ['domain_id' => $domain->id]);
            return;
        }

        $company = $domain->company;

        if (!$company) {
            Log::warning('Domain has no company while sending new incident notifications', ['domain_id' => $domain->id]);
            return;
        }

        $recipients = User::whereHas('workspaces', function ($query) use ($company) {
            $query->where('workspaces.id', $company->id);
        })
            ->whereNotNull('email_verified_at')
            ->get();

        foreach ($recipients as $user) {
            $user->notify(new DomainNewIncidentNotification($domain, $incident));
            // Record email notification as child log if we have an action handle
            if ($actionHandle) {
                $this->recordEmailIntegrationLog($actionHandle, $domain, $user, 'new_incident', [
                    'incident_ulid' => $incident?->ulid,
                ]);
            } else {
                $this->recordEmailNotificationLog($domain, $user, 'new_incident', [
                    'incident_ulid' => $incident?->ulid,
                ]);
            }
        }

        $alertData = $this->formatAlertData($domain);
        if ($incident) {
            $alertData['incident_ulid'] = $incident->ulid;
        }

        $notificationChannels = $this->resolveNotificationChannels($domain);

        foreach ($notificationChannels as $channel) {
            $integrationKey = strtolower($channel->type ?? $channel->domainIntegration?->integration?->key ?? '');

            switch ($integrationKey) {
                case 'discord':
                    DiscordNotifier::send($channel->url, $this->buildDiscordPayload($alertData), $channel->id, $actionHandle);
                    break;
                case 'slack':
                    SlackNotifier::domainAlert($channel->url, $alertData, $channel->id, $actionHandle);
                    break;
                case 'telegram':
                    TelegramNotifier::domainAlert($channel->url, $alertData, $channel->id, $actionHandle);
                    break;
                case 'clickup':
                    if ($incident) {
                        \App\Jobs\CreateClickUpTaskJob::dispatch($incident->id, $channel->id);
                        if ($actionHandle) {
                            $actionHandle->recordIntegration('clickup', [
                                'notification_channel_id' => $channel->id,
                                'integration_id' => $channel->domainIntegration?->integration_id,
                                'event_type' => SystemLogEventType::WEBHOOK_DISPATCH,
                                'source' => 'clickup-dispatcher',
                                'message' => "ClickUp task creation dispatched",
                                'execution_status' => SystemLog::EXECUTION_SUCCESS,
                            ]);
                        }
                    }
                    break;
            }
        }
    }

    protected function notifyOnStatusChange(Domain $domain, ?string $oldStatus, ?Incident $incident, ?ActionLogHandle $actionHandle = null): void
    {
        $company = $domain->company;

        if (!$company) {
            Log::warning('Domain has no company while sending status change notifications', ['domain_id' => $domain->id]);
            return;
        }

        $recipients = User::whereHas('workspaces', function ($query) use ($company) {
            $query->where('workspaces.id', $company->id);
        })
            ->whereNotNull('email_verified_at')
            ->get();

        foreach ($recipients as $user) {
            if ($oldStatus !== 'down' && $domain->status === 'down') {
                $user->notify(new DomainDownNotification($domain, $incident));
                if ($actionHandle) {
                    $this->recordEmailIntegrationLog($actionHandle, $domain, $user, 'domain_down');
                } else {
                    $this->recordEmailNotificationLog($domain, $user, 'domain_down');
                }
            } elseif ($oldStatus === 'down' && $domain->status === 'up') {
                $user->notify(new DomainUpNotification($domain, $incident));
                if ($actionHandle) {
                    $this->recordEmailIntegrationLog($actionHandle, $domain, $user, 'domain_up');
                } else {
                    $this->recordEmailNotificationLog($domain, $user, 'domain_up');
                }
            }
        }

        $alertData = $this->formatAlertData($domain);
        if ($incident && isset($incident->ulid)) {
            $alertData['incident_ulid'] = $incident->ulid;
        }

        $notificationChannels = $this->resolveNotificationChannels($domain);

        $eventLabel = $domain->status === 'up' ? 'Domain Up' : 'Domain Down';

        foreach ($notificationChannels as $channel) {
            $hasEvent = !is_array($channel->events)
                || in_array($eventLabel, $channel->events)
                || ($eventLabel === 'Domain Up' && in_array('Domain Recovered', $channel->events));

            if (!$hasEvent) {
                continue;
            }

            $integrationKey = strtolower($channel->type ?? $channel->domainIntegration?->integration?->key ?? '');

            // For Slack, Discord, Telegram, "Domain Down" is handled by trackDownAlerts (max 3 times)
            if ($eventLabel === 'Domain Down' && in_array($integrationKey, ['discord', 'slack', 'telegram'])) {
                continue;
            }

            switch ($integrationKey) {
                case 'discord':
                    DiscordNotifier::send($channel->url, $this->buildDiscordPayload($alertData), $channel->id, $actionHandle);
                    break;
                case 'slack':
                    SlackNotifier::domainAlert($channel->url, $alertData, $channel->id, $actionHandle);
                    break;
                case 'telegram':
                    TelegramNotifier::domainAlert($channel->url, $alertData, $channel->id, $actionHandle);
                    break;
                case 'clickup':
                    $targetIncident = $incident ?? Incident::where('domain_id', $domain->id)->orderByDesc('id')->first();
                    if ($targetIncident) {
                        if ($domain->status === 'down') {
                            \App\Jobs\CreateClickUpTaskJob::dispatch($targetIncident->id, $channel->id);
                        } else {
                            \App\Jobs\UpdateClickUpTaskJob::dispatch($targetIncident->id, $channel->id);
                        }
                        if ($actionHandle) {
                            $actionHandle->recordIntegration('clickup', [
                                'notification_channel_id' => $channel->id,
                                'integration_id' => $channel->domainIntegration?->integration_id,
                                'event_type' => SystemLogEventType::WEBHOOK_DISPATCH,
                                'source' => 'clickup-dispatcher',
                                'message' => "ClickUp task " . ($domain->status === 'down' ? "creation" : "update") . " dispatched",
                                'execution_status' => SystemLog::EXECUTION_SUCCESS,
                            ]);
                        }
                    }
                    break;
            }
        }
    }

    public function runSslCheck(Domain $domain, bool $suppressStatusNotification = false): void
    {
        $logContext = null;
        $daysRemaining = null;
        $shouldNotifySslExpiry = false;
        $automationActor = $this->systemLogs->automationActor('health-checker');
        $actionHandle = null;
        $linkage = $this->resolveDomainIntegrationLinkage($domain);

        try {
            $targetUrl = $domain->url;
            try {
                // Resolve redirects to get the final URL for SSL check safely
                $sslHttpTimeout = (int) config('monitoring.ssl_http_timeout', 10);
                $safeSslResult = \App\Helpers\SecurityHelper::executeSafeRequest($domain->url, [
                    'method' => 'GET',
                    'timeout' => $sslHttpTimeout,
                    'max_redirects' => 3,
                    'verify_ssl' => false,
                ]);
                if (!empty($safeSslResult['final_url'])) {
                    $targetUrl = $safeSslResult['final_url'];
                }
            } catch (Throwable $e) {
                // Fallback to original URL if the request fails
            }

            $parts = parse_url($targetUrl);

            if (!isset($parts['scheme'])) {
                return;
            }

            $host = $parts['host'] ?? null;
            $port = $parts['port'] ?? 443;

            // If the scheme is http and they provided a port like 80, we should still check 443 for SSL
            if (strtolower($parts['scheme']) !== 'https') {
                $port = 443;
            }

            if (!$host) {
                Log::warning('Cannot parse host for SSL check', ['domain_id' => $domain->id]);
                $logContext = [
                    'status' => 'failure',
                    'message' => 'Unable to parse host for SSL check',
                    'payload' => [
                        'url' => $domain->url,
                    ],
                    'error' => 'host-unavailable',
                ];
                if ($this->shouldLogSslContext($logContext)) {
                    $actionHandle = $this->ensureSslActionHandle($actionHandle, $domain, $logContext, $daysRemaining, $automationActor, $linkage);
                }
                return;
            }

            $context = stream_context_create([
                'ssl' => [
                    'capture_peer_cert' => true,
                    'verify_peer' => false,
                    'verify_peer_name' => false,
                ],
            ]);

            $sslTimeout = (int) config('monitoring.ssl_timeout', 15);
            $client = @stream_socket_client(
                "ssl://{$host}:{$port}",
                $errno,
                $errstr,
                $sslTimeout,
                STREAM_CLIENT_CONNECT,
                $context
            );

            if (!$client) {
                Log::warning('SSL connection failed', [
                    'domain_id' => $domain->id,
                    'error' => $errstr,
                    'errno' => $errno,
                ]);
                $this->markSslFailed($domain);
                $logContext = [
                    'status' => 'failure',
                    'message' => 'SSL connection failed',
                    'payload' => [
                        'host' => $host,
                        'port' => $port,
                    ],
                    'error' => $errstr,
                ];
                if ($this->shouldLogSslContext($logContext)) {
                    $actionHandle = $this->ensureSslActionHandle($actionHandle, $domain, $logContext, $daysRemaining, $automationActor, $linkage);
                }
                return;
            }

            $params = stream_context_get_params($client);
            $certResource = $params['options']['ssl']['peer_certificate'] ?? null;

            if (!$certResource) {
                Log::warning('SSL certificate missing in response', ['domain_id' => $domain->id]);
                $this->markSslFailed($domain);
                $logContext = [
                    'status' => 'failure',
                    'message' => 'SSL certificate missing in response',
                    'payload' => [
                        'host' => $host,
                        'port' => $port,
                    ],
                ];
                if ($this->shouldLogSslContext($logContext)) {
                    $actionHandle = $this->ensureSslActionHandle($actionHandle, $domain, $logContext, $daysRemaining, $automationActor, $linkage);
                }
                return;
            }

            $cert = openssl_x509_parse($certResource);

            if (!$cert || !isset($cert['validFrom_time_t'], $cert['validTo_time_t'])) {
                Log::warning('SSL certificate has invalid timestamps', ['domain_id' => $domain->id]);
                $this->markSslFailed($domain);
                $logContext = [
                    'status' => 'failure',
                    'message' => 'SSL certificate has invalid timestamps',
                    'payload' => [
                        'host' => $host,
                        'port' => $port,
                    ],
                ];
                if ($this->shouldLogSslContext($logContext)) {
                    $actionHandle = $this->ensureSslActionHandle($actionHandle, $domain, $logContext, $daysRemaining, $automationActor, $linkage);
                }
                return;
            }

            $validFrom = Carbon::createFromTimestamp($cert['validFrom_time_t']);
            $validTo = Carbon::createFromTimestamp($cert['validTo_time_t']);
            $daysRemaining = (int) now()->diffInDays($validTo, false);

            $issuer = $cert['issuer'] ?? [];
            $issuerName = is_array($issuer)
                ? implode(', ', array_map(
                    fn($k, $v) => "{$k}={$v}",
                    array_keys($issuer),
                    $issuer
                ))
                : (string) $issuer;

            $domain->ssl_issuer = $issuerName;
            $domain->ssl_valid_from = $validFrom;
            $domain->ssl_valid_to = $validTo;
            $domain->ssl_days_remaining = $daysRemaining;
            $domain->ssl_last_checked_at = \Illuminate\Support\Carbon::now();

            // Always save the latest SSL info, but do NOT update ssl_expiry_notified_days here
            $domain->save();

            $logContext = [
                'status' => 'success',
                'message' => 'SSL certificate refreshed',
                'payload' => [
                    'host' => $host,
                    'port' => $port,
                    'ssl_days_remaining' => $daysRemaining,
                    'ssl_valid_from' => $validFrom->toDateTimeString(),
                    'ssl_valid_to' => $validTo->toDateTimeString(),
                    'ssl_issuer' => $issuerName,
                ],
            ];

            // Compute the highest ssl_days_before threshold across all active SMS + WhatsApp configs
            // so the notification gate respects user-configured values (not a hardcoded 3).
            $maxSslDaysBefore = max(
                (int) SmsNotificationSetting::where('workspace_id', $domain->workspace_id)
                    ->where('domain_id', $domain->id)
                    ->where('sms_enabled', true)
                    ->max('ssl_days_before'),
                (int) WhatsappNotificationSetting::where('workspace_id', $domain->workspace_id)
                    ->where('domain_id', $domain->id)
                    ->where('whatsapp_enabled', true)
                    ->max('ssl_days_before'),
                3 // fallback minimum so email/Discord/Slack still fires at ≤3 days
            );

            // Only notify if not already notified for this daysRemaining
            $shouldNotifySslExpiry = $daysRemaining !== null
                && $daysRemaining <= $maxSslDaysBefore
                && $daysRemaining >= 0
                && $domain->ssl_expiry_notified_days !== $daysRemaining;

            // If expiring soon, adjust context to warning
            if ($shouldNotifySslExpiry) {
                $logContext['status'] = 'warning';
                $logContext['message'] = 'SSL certificate expiring soon';
            }

            // If already expired, force failure context
            if ($daysRemaining < 0) {
                $logContext['status'] = 'failure';
                $logContext['message'] = 'SSL certificate expired';
            }

            // Log::info('SSL check completed', [
            //     'domain_id' => $domain->id,
            //     'ssl_days_remaining' => $daysRemaining,
            //     'should_notify_ssl_expiry' => $shouldNotifySslExpiry,
            // ]);

            // Notify users if SSL expires in 3 days or less, only once per daysRemaining value
            if ($shouldNotifySslExpiry) {
                $company = $domain->company;
                if ($company) {
                    if ($this->shouldLogSslContext($logContext)) {
                        $actionHandle = $this->ensureSslActionHandle($actionHandle, $domain, $logContext, $daysRemaining, $automationActor, $linkage);
                    }

                    $recipients = $company->users()->get();
                    foreach ($recipients as $user) {
                        $user->notify(new DomainSslExpiringNotification($domain, $daysRemaining));
                        $payload = ['ssl_days_remaining' => $daysRemaining];

                        if ($actionHandle) {
                            $this->recordEmailIntegrationLog($actionHandle, $domain, $user, 'ssl_expiring', $payload);
                        } else {
                            $this->recordEmailNotificationLog($domain, $user, 'ssl_expiring', $payload);
                        }
                    }

                    // Discord notification for SSL expiry
                    $alertData = $this->formatAlertData($domain);
                    $alertData['title'] = 'SSL Expiry Warning';
                    $alertData['ssl_days_remaining'] = $daysRemaining === 0
                        ? 'Expires today'
                        : ($daysRemaining === 1 ? '1 day left' : $daysRemaining . ' days left');

                    $discordChannels = $company->notificationChannels()
                        ->where('type', 'discord')
                        ->where('is_active', true)
                        ->get();
                    $sslEvent = $daysRemaining === 0 ? 'SSL Expired' : 'SSL Expiring';
                    foreach ($discordChannels as $channel) {
                        if (is_array($channel->events) && !in_array($sslEvent, $channel->events)) {
                            continue;
                        }
                        // Pass channel id so webhook dispatch logs link to the right integration/webhook
                        DiscordNotifier::send($channel->url, $this->buildDiscordSslPayload($alertData), $channel->id, $actionHandle);
                    }

                    // Slack notification for SSL expiry
                    $slackChannels = $company->notificationChannels()
                        ->where('type', 'slack')
                        ->where('is_active', true)
                        ->get();
                    foreach ($slackChannels as $channel) {
                        if (is_array($channel->events) && !in_array($sslEvent, $channel->events)) {
                            continue;
                        }
                        SlackNotifier::domainAlert($channel->url, $alertData, $channel->id, $actionHandle);
                    }

                    // SMS notification for SSL expiry
                    $this->dispatchSslSmsAlerts($domain, $daysRemaining, $actionHandle);

                    // WhatsApp notification for SSL expiry
                    $this->dispatchSslWhatsappAlerts($domain, $daysRemaining, $actionHandle);

                    // Mark as notified for this daysRemaining (persist immediately)
                    $domain->ssl_expiry_notified_days = $daysRemaining;
                    $domain->save();
                } else {
                    Log::warning('Domain has no company while sending SSL expiry notifications', ['domain_id' => $domain->id]);
                }
            }
        } catch (Throwable $e) {
            Log::error('SSL check failed', [
                'domain_id' => $domain->id,
                'error' => $e->getMessage(),
            ]);
            $this->markSslFailed($domain);
            $logContext = [
                'status' => 'failure',
                'message' => 'SSL check failed',
                'payload' => [
                    'url' => $domain->url,
                ],
                'error' => $e->getMessage(),
            ];
        } finally {
            if ($this->shouldLogSslContext($logContext)) {
                $actionHandle = $this->ensureSslActionHandle($actionHandle, $domain, $logContext, $daysRemaining, $automationActor, $linkage);
                $actionHandle->markComplete(
                    $this->mapSslContextToExecutionStatus($logContext),
                    [
                        'ssl_days_remaining' => $daysRemaining,
                        'notifications_dispatched' => $shouldNotifySslExpiry,
                        'log_status' => $logContext['status'] ?? null,
                    ]
                );
            }

            if (!$suppressStatusNotification) {
                DomainStatusUpdated::dispatch($domain->fresh());
            }
        }
    }

    /**
     * Determine if we should persist SSL action logs and capture linkage context.
     */
    private function resolveDomainIntegrationLinkage(Domain $domain): array
    {
        if (isset($this->linkageCache[$domain->id])) {
            return $this->linkageCache[$domain->id];
        }

        $linkedDomainIntegrationId = null;
        $linkedIntegrationId = null;
        $linkedNotificationChannelId = null;

        try {
            $domainIntegration = DomainIntegration::query()
                ->where('domain_id', $domain->id)
                ->where('enabled', true)
                ->orderBy('id')
                ->first();

            if ($domainIntegration) {
                $linkedDomainIntegrationId = $domainIntegration->id;
                $linkedIntegrationId = $domainIntegration->integration_id;

                $linkedNotificationChannelId = NotificationChannel::query()
                    ->where('domain_id', $domain->id)
                    ->where('integration_id', $domainIntegration->id)
                    ->where('is_active', true)
                    ->orderBy('id')
                    ->value('id');
            }
        } catch (Throwable $e) {
            // Non-fatal: linkage is best-effort only.
        }

        $this->linkageCache[$domain->id] = [
            'domain_integration_id' => $linkedDomainIntegrationId,
            'integration_id' => $linkedIntegrationId,
            'notification_channel_id' => $linkedNotificationChannelId,
        ];

        return $this->linkageCache[$domain->id];
    }

    private function ensureSslActionHandle(
        ?ActionLogHandle $currentHandle,
        Domain $domain,
        array $logContext,
        ?int $daysRemaining,
        array $automationActor,
        array $linkage
    ): ActionLogHandle {
        if ($currentHandle) {
            return $currentHandle;
        }

        $payload = $logContext['payload'] ?? [];
        if ($daysRemaining !== null) {
            $payload['ssl_days_remaining'] = $daysRemaining;
        }

        return $this->systemLogs->beginAction([
            'workspace_id' => $domain->workspace_id,
            'domain_id' => $domain->id,
            'event_type' => SystemLogEventType::DOMAIN_SSL,
            'source' => 'health-checker',
            'category' => 'monitoring.ssl',
            'trigger_source' => 'ssl-monitor',
            'message' => $logContext['message'] ?? 'SSL health update',
            'status' => $logContext['status'] ?? 'info',
            'severity' => ($logContext['status'] ?? null) === 'failure' ? 'critical' : 'warning',
            'error_message' => $logContext['error'] ?? null,
            'payload' => $payload ?: null,
            'actor' => $automationActor,
        ]);
    }

    private function shouldLogSslContext(?array $logContext): bool
    {
        if (!$logContext) {
            return false;
        }

        return in_array($logContext['status'] ?? null, ['warning', 'failure'], true);
    }

    private function mapSslContextToExecutionStatus(?array $logContext): string
    {
        return match ($logContext['status'] ?? null) {
            'failure', 'warning' => SystemLog::EXECUTION_FAILURE,
            default => SystemLog::EXECUTION_SUCCESS,
        };
    }

    protected function markSslFailed(Domain $domain): void
    {
        $domain->ssl_issuer = null;
        $domain->ssl_valid_from = null;
        $domain->ssl_valid_to = null;
        $domain->ssl_days_remaining = null;
        $domain->ssl_last_checked_at = \Illuminate\Support\Carbon::now();
        $domain->save();
    }

    /**
     * Resolve active webhook channels for the provided domain, preferring
     * domain-scoped channels and falling back to workspace-level defaults when
     * none exist yet.
     *
     * @return Collection<int, NotificationChannel>
     */
    private function resolveNotificationChannels(Domain $domain): Collection
    {
        $domainChannels = NotificationChannel::query()
            ->with('domainIntegration.integration')
            ->where('workspace_id', $domain->workspace_id)
            ->where('domain_id', $domain->id)
            ->where('is_active', true)
            ->orderBy('id')
            ->get();

        $domainTypes = $domainChannels->pluck('type')->filter()->unique()->toArray();

        $workspaceChannels = NotificationChannel::query()
            ->with('domainIntegration.integration')
            ->where('workspace_id', $domain->workspace_id)
            ->whereNull('domain_id')
            ->where('is_active', true)
            ->when(!empty($domainTypes), fn($q) => $q->whereNotIn('type', $domainTypes))
            ->orderBy('id')
            ->get();

        return $domainChannels->concat($workspaceChannels);
    }

    private function dispatchWebhookAlert(NotificationChannel $channel, array $alertData, ?ActionLogHandle $actionHandle = null): void
    {
        // Safely resolve integration key from multiple sources
        $integrationKey = $channel->domainIntegration?->integration?->key
            ?? $channel->type
            ?? null;

        if (!$integrationKey) {
            Log::warning('Skipping webhook alert due to missing integration key', [
                'channel_id' => $channel->id,
                'channel_name' => $channel->name,
            ]);
            return;
        }

        try {
            if ($integrationKey === 'discord') {
                DiscordNotifier::send(
                    $channel->url,
                    $this->buildDiscordPayload($alertData),
                    $channel->id,
                    $actionHandle
                );
            } elseif ($integrationKey === 'slack') {
                SlackNotifier::domainAlert(
                    $channel->url,
                    $alertData,
                    $channel->id,
                    $actionHandle
                );
            } else {
                Log::debug('Unsupported integration type for webhook alert', [
                    'integration_key' => $integrationKey,
                    'channel_id' => $channel->id,
                ]);
            }
        } catch (\Exception $e) {
            Log::error('Failed to send webhook alert', [
                'channel_id' => $channel->id,
                'integration_key' => $integrationKey,
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function recordEmailNotificationLog(Domain $domain, User $recipient, string $notificationType, array $extraPayload = []): void
    {
        $workspaceId = $this->resolveWorkspaceId($domain);
        if (!$workspaceId) {
            return;
        }

        $integrationId = $this->integrationIdFor('email');
        if (!$integrationId) {
            return;
        }

        $subject = match ($notificationType) {
            'domain_down' => "\u{26A0}\u{FE0F} Domain DOWN: {$domain->name}",
            'domain_up' => "\u{2705} Domain UP: {$domain->name}",
            'ssl_expiring' => 'SSL Certificate Expiring Soon for ' . $domain->name,
            'new_incident' => "\u{1F6A8} New Incident: {$domain->name}",
            default => 'Workspace Email Notification',
        };

        $payload = array_merge([
            'integration_key' => 'email',
            'notification_type' => $notificationType,
            'subject' => $subject,
            'domain_id' => $domain->id,
            'domain_status' => $domain->status,
            'recipient_email' => $recipient->email,
            'recipient_user_id' => $recipient->id,
            'recipient_name' => $recipient->name,
            'dispatch_source' => 'health-checker',
        ], $extraPayload);

        $this->systemLogs->recordAsync([
            'workspace_id' => $workspaceId,
            'domain_id' => $domain->id,
            'integration_id' => $integrationId,
            'integration_key' => 'email',
            'event_type' => SystemLogEventType::SYSTEM_ALERT,
            'category' => 'notification.email',
            'source' => 'health-checker.email',
            'trigger_source' => 'email-notifier',
            'status' => 'success',
            'message' => $subject,
            'payload' => $payload,
            'actor' => $recipient,
        ]);
    }

    /**
     * Record email notification as a child integration log when using action builder.
     */
    private function recordEmailIntegrationLog(
        ActionLogHandle $actionHandle,
        Domain $domain,
        User $recipient,
        string $notificationType,
        array $extraPayload = []
    ): void {
        $integrationId = $this->integrationIdFor('email');

        $subject = match ($notificationType) {
            'domain_down' => "\u{26A0}\u{FE0F} Domain DOWN: {$domain->name}",
            'domain_up' => "\u{2705} Domain UP: {$domain->name}",
            'ssl_expiring' => 'SSL Certificate Expiring Soon for ' . $domain->name,
            'new_incident' => "\u{1F6A8} New Incident: {$domain->name}",
            default => 'Workspace Email Notification',
        };

        $integrationMetadata = SystemLogService::normalizeIntegrationMetadata([
            'recipient_email' => $recipient->email,
            'recipient' => $recipient->name,
            'subject' => $subject,
            'channel_type' => 'email',
        ]);

        $actionHandle->recordIntegration('email', [
            'integration_id' => $integrationId,
            'event_type' => SystemLogEventType::SYSTEM_ALERT,
            'category' => 'notification.email',
            'source' => 'health-checker.email',
            'trigger_source' => 'email-notifier',
            'message' => "Email sent to {$recipient->email}: {$subject}",
            'execution_status' => SystemLog::EXECUTION_SUCCESS,
            'integration_metadata' => $integrationMetadata,
            'payload' => array_merge([
                'integration_key' => 'email',
                'notification_type' => $notificationType,
                'subject' => $subject,
                'domain_id' => $domain->id,
                'domain_status' => $domain->status,
                'recipient_email' => $recipient->email,
                'recipient_user_id' => $recipient->id,
                'recipient_name' => $recipient->name,
            ], $extraPayload),
            'actor' => $recipient,
        ]);
    }

    private function resolveWorkspaceId(Domain $domain): ?int
    {
        if ($domain->workspace_id) {
            return (int) $domain->workspace_id;
        }

        $companyId = $domain->company?->id;
        return $companyId ? (int) $companyId : null;
    }

    private function integrationIdFor(string $key): ?int
    {
        if (!array_key_exists($key, $this->integrationCache)) {
            $this->integrationCache[$key] = Integration::query()
                ->where('key', $key)
                ->value('id');
        }

        return $this->integrationCache[$key];
    }

    protected function formatAlertData(Domain $domain): array
    {
        $sslDays = $domain->ssl_days_remaining;
        if ($sslDays === null) {
            $sslDisplay = 'N/A';
        } elseif ($sslDays >= 0) {
            $sslDisplay = $sslDays === 1 ? '1 day' : $sslDays . ' days';
        } else {
            $sslDisplay = abs($sslDays) === 1
                ? 'Expired 1 day ago'
                : sprintf('Expired %d days ago', abs($sslDays));
        }

        $latestEvent = DomainStatusEvent::where('domain_id', $domain->id)->latest('checked_at')->first();

        return [
            'title' => $domain->status === 'down'
                ? 'Domain Down'
                : 'Domain Up',
            'name' => $domain->name,
            'url' => $domain->url,
            'status' => $domain->status,
            'response_status' => $domain->last_response_status,
            'environment' => $domain->environment ?? 'production',
            'response_time' => $domain->last_response_time_ms
                ? $domain->last_response_time_ms . ' ms'
                : 'N/A',
            'ssl_days_remaining' => $sslDisplay,
            'region' => $latestEvent?->region,
            'region_name' => $latestEvent?->region ? \App\Services\MonitoringService::getLocationFromRegion($latestEvent->region) : null,
            'checked_at' => $latestEvent?->checked_at ? Carbon::parse($latestEvent->checked_at)->format('Y-m-d H:i:s T') : null,
        ];
    }

    protected function buildDiscordPayload(array $data): array
    {
        $isDown = strtolower($data['status']) === 'down';
        $color = $isDown ? 0xEF4444 : 0x22C55E;
        $emoji = $isDown ? '🔴' : '🟢';

        $hasIncident = $isDown && !empty($data['incident_ulid']);

        $title = $hasIncident
            ? sprintf('New Incident Recorded: %s', $data['name'])
            : $data['title'];

        $fields = [
            // ===== Row 1 =====
            [
                'name' => 'Domain Status',
                'value' => sprintf('`%s`', $isDown ? 'DOWN' : 'UP'),
                'inline' => true,
            ],
            [
                'name' => 'Response Status',
                'value' => sprintf('`%s`', $data['response_status']),
                'inline' => true,
            ],
            [
                'name' => 'Environment',
                'value' => sprintf('`%s`', strtoupper($data['environment'])),
                'inline' => true,
            ],

            // ===== Row 2 =====
            [
                'name' => 'Response Time',
                'value' => sprintf('`%s`', $data['response_time'] ?? 'N/A'),
                'inline' => true,
            ],
            [
                'name' => 'SSL Days Remaining',
                'value' => sprintf('`%s`', $data['ssl_days_remaining'] ?? '-'),
                'inline' => true,
            ],
            [
                // spacer to complete row
                'name' => "\u{200B}",
                'value' => "\u{200B}",
                'inline' => true,
            ],
        ];

        // ===== Region (full-width or row 3) =====
        if (!empty($data['region'])) {
            $fields[] = [
                'name' => 'Region',
                'value' => sprintf('`%s (%s)`', $data['region_name'], $data['region']),
                'inline' => true,
            ];
            $fields[] = [
                'name' => 'Check Time',
                'value' => sprintf('`%s`', $data['checked_at']),
                'inline' => true,
            ];
            $fields[] = [
                'name' => "\u{200B}",
                'value' => "\u{200B}",
                'inline' => true,
            ];
        }

        // ===== Incident (full-width) =====
        if ($hasIncident) {
            $incidentUrl = rtrim(env('FRONTEND_URL'), '/') . '/incidents/' . $data['incident_ulid'];

            $fields[] = [
                'name' => 'Incident',
                'value' => sprintf('[#%s](%s)', $data['incident_ulid'], $incidentUrl),
                'inline' => false, // 👈 full width
            ];
        }

        return [
            'embeds' => [
                [
                    'title' => sprintf('%s %s', $emoji, $title),
                    'description' => sprintf('Domain: [%s](%s)', $data['name'], $data['url']),
                    'color' => $color,
                    'fields' => $fields,
                    'footer' => [
                        'text' => config('app.name'),
                    ],
                    'timestamp' => now()->toIso8601String(),
                ]
            ],
        ];
    }


    // Discord payload for SSL expiry
    protected function buildDiscordSslPayload(array $data): array
    {
        $color = 0xF59E42; // orange for warning
        $emoji = '⚠️';

        $payload = [];

        $payload = [
            'embeds' => [
                [
                    'title' => sprintf('%s %s', $emoji, $data['title']),
                    'description' => sprintf('Domain: [%s](%s)', $data['name'], $data['url']),
                    'color' => $color,
                    'fields' => [
                        [
                            'name' => 'SSL Expiry',
                            'value' => $data['ssl_days_remaining'],
                            'inline' => true,
                        ],
                        [
                            'name' => 'Environment',
                            'value' => ucfirst($data['environment']),
                            'inline' => true,
                        ],
                        [
                            'name' => 'Status',
                            'value' => strtoupper($data['status']),
                            'inline' => true,
                        ],
                    ],
                    'footer' => [
                        'text' => config('app.name'),
                    ],
                    'timestamp' => now()->toIso8601String(),
                ]
            ],
        ];

        // Add incident link if incident not empty and if domain is down
        if ($data['status'] === 'down' && !empty($data['incident'])) {
            $payload['embeds'][0]['fields'][] = [
                'name' => 'Incident',
                'value' => sprintf('[%s](%s)', $data['incident']->title, env('FRONTEND_URL') . '//incidents/' . $data['incident']->ulid),
                'inline' => true,
            ];
        }

        return $payload;
    }

    /* ================= WhatsApp Template Parameter Builders ================= */

    /**
     * Build body parameters for the boomerr_domain_alert template.
     *
     * Template body:
     * Your {{domain_name}} is *{{status}}*
     * 🌐 {{url}}
     * ⚠️ Response: {{response}}
     * ⏱️ Resp. Time: {{resp_time}}
     * 🌍 Environment: {{domain_env}}
     * 🔒 SSL: {{ssl}} days left
     * 🔢 Failures: {{failures_count}}
     * 🕒 {{time}}
     */
    private function buildDomainAlertBodyParams(Domain $domain, string $status): array
    {
        $sslDays = $domain->ssl_days_remaining;
        $sslDisplay = $sslDays === null ? 'N/A' : (string) $sslDays;

        $responseTime = $domain->last_response_time_ms
            ? $domain->last_response_time_ms . ' ms'
            : 'Timed out';

        $latestEvent = DomainStatusEvent::where('domain_id', $domain->id)->latest('checked_at')->first();
        $regionName = $latestEvent?->region ? \App\Services\MonitoringService::getLocationFromRegion($latestEvent->region) : 'N/A';
        $regionStr = $latestEvent?->region ? "{$regionName} ({$latestEvent->region})" : 'N/A';

        return [
            'domain_name' => $domain->name ?? $domain->url,
            'status' => strtoupper($status),
            'url' => $domain->url,
            'response' => (string) ($domain->last_response_status ?? 'N/A'),
            'resp_time' => $responseTime,
            'domain_env' => ucfirst($domain->environment ?? 'production'),
            'region' => $regionStr,
            'ssl' => $sslDisplay,
            'failures_count' => (string) $domain->failure_count,
            'time' => now()->format('d M Y, H:i:s') . ' UTC',
        ];
    }

    /**
     * Build body parameters for the boomerr_domain_ssl_alert template.
     *
     * Template body:
     * Your SSL certificate for *{{domain_name}}* requires attention
     * 🌐 {{url}}
     * 🌍 Environment: {{domain_env}}
     * ⏳ Days Remaining: {{ssl}} days left
     * 🕒 {{time}}
     */
    private function buildSslAlertBodyParams(Domain $domain, int $daysRemaining): array
    {
        return [
            'domain_name' => $domain->name ?? $domain->url,
            'url' => $domain->url,
            'domain_env' => ucfirst($domain->environment ?? 'production'),
            'ssl' => (string) $daysRemaining,
            'time' => now()->format('d M Y, H:i:s') . ' UTC',
        ];
    }

    /**
     * Build header parameters for the boomerr_domain_status_alert template.
     *
     * Typically the header contains the domain name.
     */
    private function buildDomainAlertHeaderParams(Domain $domain): array
    {
        return [
            'domain_name' => $domain->name ?? $domain->url,
        ];
    }

    /**
     * Build header parameters for the boomerr_domain_ssl_alert template.
     *
     * Typically the header contains the domain name.
     */
    private function buildSslAlertHeaderParams(Domain $domain): array
    {
        return [
            'domain_name' => $domain->name ?? $domain->url,
        ];
    }

    /* ================= Alert Message Builders (SMS plain text) ================= */

    /**
     * Build a professional domain-down alert message for SMS / WhatsApp.
     */
    private function buildDomainDownAlertMessage(Domain $domain): string
    {
        $responseStatus = $domain->last_response_status ?? 'N/A';
        $environment = ucfirst($domain->environment ?? 'production');
        $sslDays = $domain->ssl_days_remaining;

        if ($sslDays === null) {
            $sslDisplay = 'N/A';
        } elseif ($sslDays < 0) {
            $sslDisplay = 'Expired ' . abs($sslDays) . 'd ago ⚠️';
        } else {
            $sslDisplay = $sslDays . ' day' . ($sslDays === 1 ? '' : 's') . ' left';
        }

        $responseTime = $domain->last_response_time_ms
            ? $domain->last_response_time_ms . ' ms'
            : 'Timed out';

        $latestEvent = DomainStatusEvent::where('domain_id', $domain->id)->latest('checked_at')->first();
        $regionName = $latestEvent?->region ? \App\Services\MonitoringService::getLocationFromRegion($latestEvent->region) : 'N/A';
        $regionStr = $latestEvent?->region ? "{$regionName} ({$latestEvent->region})" : 'N/A';

        $sep = '━━━━━━━━━━━━━━━';

        return implode("\n", [
            "🚨 *DOMAIN DOWN ALERT*",
            $sep,
            "",
            "❌ *{$domain->name}* is *DOWN*",
            "",
            "🌐  {$domain->url}",
            "⚠️ *Response:* {$responseStatus}",
            "⏱️ *Resp. Time:* {$responseTime}",
            "🌍 *Environment:* {$environment}",
            "📍 *Region:* {$regionStr}",
            "🔒 *SSL:* {$sslDisplay}",
            "🔢 *Failures:* {$domain->failure_count}",
            "🕒 " . now()->format('d M Y, H:i:s') . " UTC",
            "",
            "⚡ *Immediate action may be required!*",
            $sep,
            "Sent by " . "*" . config('app.name') . "*",
        ]);
    }

    /**
     * Build a professional domain-up alert message for SMS / WhatsApp.
     */
    private function buildDomainUpAlertMessage(Domain $domain): string
    {
        $environment = ucfirst($domain->environment ?? 'production');
        $sslDays = $domain->ssl_days_remaining;

        if ($sslDays === null) {
            $sslDisplay = 'N/A';
        } elseif ($sslDays < 0) {
            $sslDisplay = 'Expired ' . abs($sslDays) . 'd ago ⚠️';
        } else {
            $sslDisplay = $sslDays . ' day' . ($sslDays === 1 ? '' : 's') . ' left';
        }

        $responseTime = $domain->last_response_time_ms
            ? $domain->last_response_time_ms . ' ms'
            : 'N/A';

        $latestEvent = DomainStatusEvent::where('domain_id', $domain->id)->latest('checked_at')->first();
        $regionName = $latestEvent?->region ? \App\Services\MonitoringService::getLocationFromRegion($latestEvent->region) : 'N/A';
        $regionStr = $latestEvent?->region ? "{$regionName} ({$latestEvent->region})" : 'N/A';

        $sep = '━━━━━━━━━━━━━━━';

        return implode("\n", [
            "✅ *DOMAIN UP NOTIFICATION*",
            $sep,
            "",
            "✔️ *{$domain->name}* is *UP*",
            "",
            "🌐  {$domain->url}",
            "⏱️ *Resp. Time:* {$responseTime}",
            "🌍 *Environment:* {$environment}",
            "📍 *Region:* {$regionStr}",
            "🔒 *SSL:* {$sslDisplay}",
            "🕒 " . now()->format('d M Y, H:i:s') . " UTC",
            "",
            "✨ *Service is operational!*",
            $sep,
            "Sent by " . "*" . config('app.name') . "*",
        ]);
    }

    /**
     * Build a professional SSL expiry alert message for SMS / WhatsApp.
     */
    private function buildSslExpiryAlertMessage(Domain $domain, int $daysRemaining): string
    {
        $environment = ucfirst($domain->environment ?? 'production');
        $expiry = $domain->ssl_valid_to
            ? Carbon::parse($domain->ssl_valid_to)->format('d M Y')
            : 'Unknown';

        $urgency = match (true) {
            $daysRemaining === 0 => "🔴 *EXPIRES TODAY* - Act immediately!",
            $daysRemaining === 1 => "🔴 *1 day left* - Renew now!",
            $daysRemaining <= 3 => "🟠 *{$daysRemaining} days left* - Renew urgently!",
            default => "🟡 *{$daysRemaining} days left* - Renew soon.",
        };

        $sep = '━━━━━━━━━━━━━━━';

        return implode("\n", [
            "🔒 *SSL CERTIFICATE EXPIRY ALERT*",
            $sep,
            "",
            "🌐 {$domain->url}",
            "🌍 *Environment:* {$environment}",
            "📅 *Expires:*     {$expiry}",
            $urgency,
            "",
            "🕒 " . now()->format('d M Y, H:i:s') . " UTC",
            $sep,
            "Sent by " . "*" . config('app.name') . "*",
        ]);
    }

    /* ================= SMS Alert Logic =================

    /**
     * Dispatch SMS and WhatsApp down alerts on each check.
     * Limit down alerts to 3 consecutive times only.
     * Resets counters when domain is UP, sends alerts every check while DOWN (max 3 times).
     */
    protected function trackDownAlerts(Domain $domain, bool $isResponseSuccessful, ?ActionLogHandle $actionHandle = null): void
    {
        $throttleKey = "down_alert_throttle_{$domain->id}";

        if ($isResponseSuccessful) {
            \Illuminate\Support\Facades\Cache::forget($throttleKey);
            if ($domain->failure_count > 0 || $domain->consecutive_down_alert_count > 0) {
                $domain->failure_count = 0;
                $domain->consecutive_down_alert_count = 0;
                $domain->save();
            }
            return;
        }

        // Increment failure count each down check (cap at 100 to prevent unbounded growth)
        if ($domain->failure_count < 100) {
            $domain->increment('failure_count');
            $domain->refresh();
        }

        // Check if we've already sent 3 consecutive alerts - if so, stop sending
        if ($domain->consecutive_down_alert_count >= 3) {
            Log::info("consecutive_down_alert_count is {$domain->consecutive_down_alert_count} (>= 3). Suppressing further DOWN alerts.", [
                'domain_id' => $domain->id
            ]);
            return;
        }

        // Multi-region / rapid check throttle: ensure we do not dispatch duplicate alert bursts
        if (!\Illuminate\Support\Facades\Cache::add($throttleKey, true, 30)) {
            Log::debug("Skipping duplicate down alert dispatch within throttle window", ['domain_id' => $domain->id]);
            return;
        }

        $smsDisabled = WorkspaceIntegration::whereHas('integration', fn($q) => $q->where('key', 'sms'))
            ->where('workspace_id', $domain->workspace_id)
            ->where('enabled', false)
            ->exists();

        $waDisabled = WorkspaceIntegration::whereHas('integration', fn($q) => $q->where('key', 'whatsapp'))
            ->where('workspace_id', $domain->workspace_id)
            ->where('enabled', false)
            ->exists();

        $smsDispatched = false;
        $waDispatched = false;

        /* ----- SMS ----- */
        if (!$smsDisabled) {
            $smsConfigs = SmsNotificationSetting::where('workspace_id', $domain->workspace_id)
                ->where('domain_id', $domain->id)
                ->where('sms_enabled', true)
                ->whereNotNull('phone_number')
                ->get();

            foreach ($smsConfigs as $settings) {
                // Only alert if we've reached the down threshold
                if ($domain->failure_count < $settings->down_threshold) {
                    continue;
                }
                if (is_array($settings->events) && !in_array('Domain Down', $settings->events)) {
                    continue;
                }

                try {
                    SendSmsAlertJob::dispatchSync(
                        $settings->phone_number,
                        str_replace('*', '', $this->buildDomainDownAlertMessage($domain)),
                        [
                            'domain' => Str::limit(parse_url($domain->url, PHP_URL_HOST), 30),
                            'response' => (string) ($domain->last_response_status ?? 'N/A'),
                            'environment' => $domain->environment ?? 'production',
                            'failure' => (string) $domain->failure_count,
                        ],
                        $domain->workspace_id,
                        $domain->id,
                        $settings->id
                    );
                    $smsDispatched = true;

                    if ($actionHandle) {
                        $actionHandle->recordIntegration('sms', [
                            'event_type' => SystemLogEventType::SYSTEM_ALERT,
                            'category' => 'notification.sms',
                            'source' => 'health-checker.sms',
                            'trigger_source' => 'sms-notifier',
                            'message' => "SMS alert dispatched to {$settings->phone_number}",
                            'execution_status' => SystemLog::EXECUTION_SUCCESS,
                            'integration_metadata' => [
                                'recipient' => $settings->phone_number,
                                'channel_type' => 'sms',
                            ],
                        ]);
                    }

                    Log::info('SMS domain-down alert dispatched', [
                        'domain_id' => $domain->id,
                        'config_id' => $settings->id,
                        'phone' => $settings->phone_number,
                        'failure_count' => $domain->failure_count,
                        'alert_number' => $domain->consecutive_down_alert_count + 1,
                    ]);
                } catch (Throwable $e) {
                    if ($actionHandle) {
                        $actionHandle->recordIntegration('sms', [
                            'event_type' => SystemLogEventType::SYSTEM_ALERT,
                            'category' => 'notification.sms',
                            'source' => 'health-checker.sms',
                            'trigger_source' => 'sms-notifier',
                            'message' => 'SMS domain-down alert failed: ' . $e->getMessage(),
                            'execution_status' => SystemLog::EXECUTION_FAILURE,
                            'error_message' => $e->getMessage(),
                            'integration_metadata' => [
                                'recipient' => $settings->phone_number,
                                'channel_type' => 'sms',
                                'error' => $e->getMessage(),
                            ],
                        ]);
                    }
                    Log::error('SMS domain-down alert FAILED', [
                        'domain_id' => $domain->id,
                        'config_id' => $settings->id,
                        'phone' => $settings->phone_number,
                        'error' => $e->getMessage(),
                    ]);
                }
            }
        }

        /* ----- WhatsApp ----- */
        if (!$waDisabled) {
            $waConfigs = WhatsappNotificationSetting::where('workspace_id', $domain->workspace_id)
                ->where('domain_id', $domain->id)
                ->where('whatsapp_enabled', true)
                ->whereNotNull('phone_number')
                ->get();

            foreach ($waConfigs as $settings) {
                // Only alert if we've reached the down threshold
                if ($domain->failure_count < $settings->down_threshold) {
                    continue;
                }
                if (is_array($settings->events) && !in_array('Domain Down', $settings->events)) {
                    continue;
                }

                try {
                    $domainAlertTemplate = (string) config('services.whatsapp.templates.domain_alert', 'boomerr_domain_status_alert');
                    $templateLanguage = 'en';

                    SendWhatsAppAlertJob::dispatchSync(
                        $settings->phone_number,
                        $this->buildDomainDownAlertMessage($domain),     // SMS-style fallback
                        $domainAlertTemplate,
                        $this->buildDomainAlertBodyParams($domain, 'DOWN'),
                        $templateLanguage,
                        $this->buildDomainAlertHeaderParams($domain),
                        $domain->workspace_id,
                        $domain->id,
                        $settings->id
                    );
                    $waDispatched = true;

                    if ($actionHandle) {
                        $actionHandle->recordIntegration('whatsapp', [
                            'event_type' => SystemLogEventType::SYSTEM_ALERT,
                            'category' => 'notification.whatsapp',
                            'source' => 'health-checker.whatsapp',
                            'trigger_source' => 'whatsapp-notifier',
                            'message' => "WhatsApp alert dispatched to {$settings->phone_number}",
                            'execution_status' => SystemLog::EXECUTION_SUCCESS,
                            'integration_metadata' => [
                                'recipient' => $settings->phone_number,
                                'channel_type' => 'whatsapp',
                            ],
                        ]);
                    }

                    Log::info('WhatsApp domain-down alert dispatched', [
                        'domain_id' => $domain->id,
                        'config_id' => $settings->id,
                        'phone' => $settings->phone_number,
                        'failure_count' => $domain->failure_count,
                        'alert_number' => $domain->consecutive_down_alert_count + 1,
                    ]);
                } catch (Throwable $e) {
                    if ($actionHandle) {
                        $actionHandle->recordIntegration('whatsapp', [
                            'event_type' => SystemLogEventType::SYSTEM_ALERT,
                            'category' => 'notification.whatsapp',
                            'source' => 'health-checker.whatsapp',
                            'trigger_source' => 'whatsapp-notifier',
                            'message' => 'WhatsApp domain-down alert failed: ' . $e->getMessage(),
                            'execution_status' => SystemLog::EXECUTION_FAILURE,
                            'error_message' => $e->getMessage(),
                            'integration_metadata' => [
                                'recipient' => $settings->phone_number,
                                'channel_type' => 'whatsapp',
                                'error' => $e->getMessage(),
                            ],
                        ]);
                    }
                    Log::error('WhatsApp domain-down alert FAILED', [
                        'domain_id' => $domain->id,
                        'config_id' => $settings->id,
                        'phone' => $settings->phone_number,
                        'error' => $e->getMessage(),
                    ]);
                }
            }
        }

        /* ----- Integrated Integrations (Slack, Discord, Telegram) ----- */
        $notificationChannels = $this->resolveNotificationChannels($domain)
            ->filter(fn($c) => in_array(strtolower($c->type ?? ''), ['slack', 'discord', 'telegram']));

        $webhookDispatched = false;
        $alertData = $this->formatAlertData($domain);
        $incident = Incident::where('domain_id', $domain->id)->where('status', 'ongoing')->latest('started_at')->first();
        if ($incident) {
            $alertData['incident_ulid'] = $incident->ulid;
        }

        foreach ($notificationChannels as $channel) {
            // Only alert if we've reached the down threshold (assumed 1 for webhooks)
            if ($domain->failure_count < 1) {
                continue;
            }

            if (is_array($channel->events) && !in_array('Domain Down', $channel->events)) {
                continue;
            }

            $integrationKey = strtolower($channel->type);

            try {
                switch ($integrationKey) {
                    case 'discord':
                        DiscordNotifier::send($channel->url, $this->buildDiscordPayload($alertData), $channel->id, $actionHandle);
                        $webhookDispatched = true;
                        break;
                    case 'slack':
                        SlackNotifier::domainAlert($channel->url, $alertData, $channel->id, $actionHandle);
                        $webhookDispatched = true;
                        break;
                    case 'telegram':
                        TelegramNotifier::domainAlert($channel->url, $alertData, $channel->id, $actionHandle);
                        $webhookDispatched = true;
                        break;
                }
            } catch (Throwable $e) {
                Log::error("{$integrationKey} domain-down alert FAILED", [
                    'domain_id' => $domain->id,
                    'channel_id' => $channel->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        /* ----- Increment consecutive alert count unconditionally for this check cycle (max 3) ----- */
        $domain->consecutive_down_alert_count += 1;
        if ($smsDispatched) {
            $domain->last_sms_at = \Illuminate\Support\Carbon::now();
        }
        if ($waDispatched) {
            $domain->last_whatsapp_at = \Illuminate\Support\Carbon::now();
        }
        $domain->save();

        Log::info("Dispatched DOWN alert cycle #{$domain->consecutive_down_alert_count} of 3 for domain #{$domain->id}", [
            'domain_id' => $domain->id,
            'alert_number' => $domain->consecutive_down_alert_count,
            'sms_dispatched' => $smsDispatched,
            'wa_dispatched' => $waDispatched,
            'webhook_dispatched' => $webhookDispatched,
        ]);
    }

    /**
     * Dispatch SMS and WhatsApp UP alerts to notify that domain is back online.
     */
    protected function trackUpAlerts(Domain $domain, ?ActionLogHandle $actionHandle = null): void
    {
        // Only send UP alerts if domain was previously down (had consecutive down alerts)
        if ($domain->consecutive_down_alert_count === 0) {
            return;
        }

        $smsDisabled = WorkspaceIntegration::whereHas('integration', fn($q) => $q->where('key', 'sms'))
            ->where('workspace_id', $domain->workspace_id)
            ->where('enabled', false)
            ->exists();

        $waDisabled = WorkspaceIntegration::whereHas('integration', fn($q) => $q->where('key', 'whatsapp'))
            ->where('workspace_id', $domain->workspace_id)
            ->where('enabled', false)
            ->exists();

        /* ----- SMS ----- */
        if (!$smsDisabled) {
            $smsConfigs = SmsNotificationSetting::where('workspace_id', $domain->workspace_id)
                ->where('domain_id', $domain->id)
                ->where('sms_enabled', true)
                ->whereNotNull('phone_number')
                ->get();

            foreach ($smsConfigs as $settings) {
                if (is_array($settings->events) && !in_array('Domain Up', $settings->events)) {
                    continue;
                }
                try {
                    SendSmsAlertJob::dispatchSync(
                        $settings->phone_number,
                        str_replace('*', '', $this->buildDomainUpAlertMessage($domain)),
                        [
                            'domain' => $domain->name ?? $domain->url,
                            'response' => (string) ($domain->last_response_status ?? 'N/A'),
                            'environment' => $domain->environment ?? 'production',
                            'checked_at' => (string) ($domain->last_checked_at ? $domain->last_checked_at->format('d-m-Y H:i A') : 'N/A'),
                        ],
                        $domain->workspace_id,
                        $domain->id,
                        $settings->id
                    );

                    if ($actionHandle) {
                        $actionHandle->recordIntegration('sms', [
                            'event_type' => SystemLogEventType::SYSTEM_ALERT,
                            'category' => 'notification.sms',
                            'source' => 'health-checker.sms',
                            'trigger_source' => 'sms-notifier',
                            'message' => "SMS domain-up alert dispatched to {$settings->phone_number}",
                            'execution_status' => SystemLog::EXECUTION_SUCCESS,
                            'integration_metadata' => [
                                'recipient' => $settings->phone_number,
                                'channel_type' => 'sms',
                            ],
                        ]);
                    }

                    Log::info('SMS domain-up alert dispatched', [
                        'domain_id' => $domain->id,
                        'config_id' => $settings->id,
                        'phone' => $settings->phone_number,
                    ]);
                } catch (Throwable $e) {
                    if ($actionHandle) {
                        $actionHandle->recordIntegration('sms', [
                            'event_type' => SystemLogEventType::SYSTEM_ALERT,
                            'category' => 'notification.sms',
                            'source' => 'health-checker.sms',
                            'trigger_source' => 'sms-notifier',
                            'message' => "SMS domain-up alert failed: " . $e->getMessage(),
                            'execution_status' => SystemLog::EXECUTION_FAILURE,
                            'error_message' => $e->getMessage(),
                            'integration_metadata' => [
                                'recipient' => $settings->phone_number,
                                'channel_type' => 'sms',
                                'error' => $e->getMessage(),
                            ],
                        ]);
                    }
                    Log::error('SMS domain-up alert FAILED', [
                        'domain_id' => $domain->id,
                        'config_id' => $settings->id,
                        'phone' => $settings->phone_number,
                        'error' => $e->getMessage(),
                    ]);
                }
            }
        }

        /* ----- WhatsApp ----- */
        if (!$waDisabled) {
            $waConfigs = WhatsappNotificationSetting::where('workspace_id', $domain->workspace_id)
                ->where('domain_id', $domain->id)
                ->where('whatsapp_enabled', true)
                ->whereNotNull('phone_number')
                ->get();

            foreach ($waConfigs as $settings) {
                if (is_array($settings->events) && !in_array('Domain Up', $settings->events)) {
                    continue;
                }
                try {
                    $domainAlertTemplate = (string) config('services.whatsapp.templates.domain_alert', 'boomerr_domain_status_alert');
                    $templateLanguage = 'en';

                    SendWhatsAppAlertJob::dispatchSync(
                        $settings->phone_number,
                        $this->buildDomainUpAlertMessage($domain),       // SMS-style fallback
                        $domainAlertTemplate,
                        $this->buildDomainAlertBodyParams($domain, 'UP'),
                        $templateLanguage,
                        $this->buildDomainAlertHeaderParams($domain),
                        $domain->workspace_id,
                        $domain->id,
                        $settings->id
                    );

                    if ($actionHandle) {
                        $actionHandle->recordIntegration('whatsapp', [
                            'event_type' => SystemLogEventType::SYSTEM_ALERT,
                            'category' => 'notification.whatsapp',
                            'source' => 'health-checker.whatsapp',
                            'trigger_source' => 'whatsapp-notifier',
                            'message' => "WhatsApp domain-up alert dispatched to {$settings->phone_number}",
                            'execution_status' => SystemLog::EXECUTION_SUCCESS,
                            'integration_metadata' => [
                                'recipient' => $settings->phone_number,
                                'channel_type' => 'whatsapp',
                            ],
                        ]);
                    }

                    Log::info('WhatsApp domain-up alert dispatched', [
                        'domain_id' => $domain->id,
                        'config_id' => $settings->id,
                        'phone' => $settings->phone_number,
                    ]);
                } catch (Throwable $e) {
                    if ($actionHandle) {
                        $actionHandle->recordIntegration('whatsapp', [
                            'event_type' => SystemLogEventType::SYSTEM_ALERT,
                            'category' => 'notification.whatsapp',
                            'source' => 'health-checker.whatsapp',
                            'trigger_source' => 'whatsapp-notifier',
                            'message' => "WhatsApp domain-up alert failed: " . $e->getMessage(),
                            'execution_status' => SystemLog::EXECUTION_FAILURE,
                            'error_message' => $e->getMessage(),
                            'integration_metadata' => [
                                'recipient' => $settings->phone_number,
                                'channel_type' => 'whatsapp',
                                'error' => $e->getMessage(),
                            ],
                        ]);
                    }
                    Log::error('WhatsApp domain-up alert FAILED', [
                        'domain_id' => $domain->id,
                        'config_id' => $settings->id,
                        'phone' => $settings->phone_number,
                        'error' => $e->getMessage(),
                    ]);
                }
            }
        }

        // Reset counters after sending UP alerts
        $domain->failure_count = 0;
        $domain->consecutive_down_alert_count = 0;
        $domain->last_sms_at = \Illuminate\Support\Carbon::now();
        $domain->last_whatsapp_at = \Illuminate\Support\Carbon::now();
        $domain->save();
    }

    /**
     * Dispatch SMS alerts for SSL certificate expiry.
     * Called from runSslCheck when SSL is about to expire.
     */
    protected function dispatchSslSmsAlerts(Domain $domain, int $daysRemaining, ?ActionLogHandle $actionHandle = null): void
    {
        $configs = SmsNotificationSetting::where('workspace_id', $domain->workspace_id)
            ->where('domain_id', $domain->id)
            ->where('sms_enabled', true)
            ->whereNotNull('phone_number')
            ->get();

        $sslEvent = $daysRemaining === 0 ? 'SSL Expired' : 'SSL Expiring';

        foreach ($configs as $settings) {
            if ($daysRemaining > $settings->ssl_days_before) {
                continue;
            }

            if (is_array($settings->events) && !in_array($sslEvent, $settings->events)) {
                continue;
            }

            $message = $this->buildSslExpiryAlertMessage($domain, $daysRemaining);

            SendSmsAlertJob::dispatchSync($settings->phone_number, str_replace('*', '', $message), [], $domain->workspace_id, $domain->id, $settings->id);

            if ($actionHandle) {
                $actionHandle->recordIntegration('sms', [
                    'event_type' => SystemLogEventType::SYSTEM_ALERT,
                    'category' => 'notification.sms',
                    'source' => 'health-checker.sms',
                    'trigger_source' => 'sms-notifier',
                    'message' => "SMS SSL-expiry alert dispatched to {$settings->phone_number}",
                    'execution_status' => SystemLog::EXECUTION_SUCCESS,
                    'integration_metadata' => [
                        'recipient' => $settings->phone_number,
                        'channel_type' => 'sms',
                    ],
                ]);
            }

            Log::info('SMS SSL-expiry alert dispatched', [
                'domain_id' => $domain->id,
                'config_id' => $settings->id,
                'days_remaining' => $daysRemaining,
                'phone' => $settings->phone_number,
            ]);

            // Only stamp last_sms_at when an alert was actually sent
            $domain->last_sms_at = \Illuminate\Support\Carbon::now();
            $domain->save();
        }
    }

    /**
     * Dispatch WhatsApp alerts for SSL certificate expiry.
     */
    protected function dispatchSslWhatsappAlerts(Domain $domain, int $daysRemaining, ?ActionLogHandle $actionHandle = null): void
    {
        $configs = WhatsappNotificationSetting::where('workspace_id', $domain->workspace_id)
            ->where('domain_id', $domain->id)
            ->where('whatsapp_enabled', true)
            ->whereNotNull('phone_number')
            ->get();

        $sslEvent = $daysRemaining === 0 ? 'SSL Expired' : 'SSL Expiring';

        foreach ($configs as $settings) {
            if ($daysRemaining > $settings->ssl_days_before) {
                continue;
            }

            if (is_array($settings->events) && !in_array($sslEvent, $settings->events)) {
                continue;
            }

            $message = $this->buildSslExpiryAlertMessage($domain, $daysRemaining);
            $sslAlertTemplate = (string) config('services.whatsapp.templates.ssl_alert', 'boomerr_domain_ssl_alert');
            $templateLanguage = 'en';

            SendWhatsAppAlertJob::dispatchSync(
                $settings->phone_number,
                $message,                                            // SMS-style fallback
                $sslAlertTemplate,
                $this->buildSslAlertBodyParams($domain, $daysRemaining),
                $templateLanguage,
                $this->buildSslAlertHeaderParams($domain),
                $domain->workspace_id,
                $domain->id,
                $settings->id
            );

            if ($actionHandle) {
                $actionHandle->recordIntegration('whatsapp', [
                    'event_type' => SystemLogEventType::SYSTEM_ALERT,
                    'category' => 'notification.whatsapp',
                    'source' => 'health-checker.whatsapp',
                    'trigger_source' => 'whatsapp-notifier',
                    'message' => "WhatsApp SSL-expiry alert dispatched to {$settings->phone_number}",
                    'execution_status' => SystemLog::EXECUTION_SUCCESS,
                    'integration_metadata' => [
                        'recipient' => $settings->phone_number,
                        'channel_type' => 'whatsapp',
                    ],
                ]);
            }

            Log::info('WhatsApp SSL-expiry alert dispatched', [
                'domain_id' => $domain->id,
                'config_id' => $settings->id,
                'days_remaining' => $daysRemaining,
                'phone' => $settings->phone_number,
            ]);

            // Only stamp last_whatsapp_at when an alert was actually sent
            $domain->last_whatsapp_at = \Illuminate\Support\Carbon::now();
            $domain->save();
        }
    }

    /**
     * Run a confirmation check (attempt 2 or 3) before marking a domain as DOWN.
     */
    public function runConfirmationCheck(
        Domain $domain,
        int $attempt,
        ?int $initialHttpStatus = null,
        ?string $initialFailureReason = null,
        string $source = 'local',
        string $region = 'local',
        string $location = 'local'
    ): void {
        Log::info("Executing uptime confirmation check #{$attempt} for domain #{$domain->id} ({$domain->url})", [
            'domain_id' => $domain->id,
            'attempt' => $attempt,
            'source' => $source,
            'region' => $region,
        ]);

        $startedAt = microtime(true);
        $isResponseSuccessful = false;
        $httpStatus = null;
        $failureReason = null;
        $durationMs = null;

        // SSRF Guard
        $reason = null;
        if (!\App\Helpers\SecurityHelper::isSafeUrl($domain->url, $reason)) {
            Log::warning("SSRF Protection: Confirmation check aborted for domain #{$domain->id}: {$reason}");
            return;
        }

        try {
            $timeout = (int) config('monitoring.http_timeout', 20);
            $safeConfirm = \App\Helpers\SecurityHelper::executeSafeRequest($domain->url, [
                'method' => 'GET',
                'timeout' => $timeout,
                'max_redirects' => 5,
                'verify_ssl' => false,
            ]);

            $httpStatus = $safeConfirm['http_code'];
            $durationMs = $safeConfirm['total_time_ms'];
            $isResponseSuccessful = ($httpStatus >= 200 && $httpStatus < 400);

            if (!$isResponseSuccessful) {
                $failureReason = sprintf('HTTP %s %s', $httpStatus, $safeConfirm['error'] ?? 'Error');
            }
        } catch (Throwable $e) {
            $isResponseSuccessful = false;
            $failureReason = $e->getMessage();
            $httpStatus = null;
        }

        if ($isResponseSuccessful) {
            // Confirmation check passed: domain is actually UP!
            \Illuminate\Support\Facades\Cache::forget("domain_down_confirmation_{$domain->id}");
            $domain->status = 'up';
            $domain->last_response_status = $httpStatus ?? 200;
            $domain->last_response_time_ms = $durationMs;
            $domain->last_checked_at = \Illuminate\Support\Carbon::now();
            $domain->save();

            Log::info("Confirmation check #{$attempt} SUCCEEDED for domain #{$domain->id} ({$domain->url}). Temporary failure dismissed, domain remains UP.", [
                'domain_id' => $domain->id,
                'attempt' => $attempt,
                'http_status' => $httpStatus,
                'duration_ms' => $durationMs,
            ]);
            return;
        }

        // Confirmation check failed
        if ($attempt < 3) {
            // Check #2 failed. Schedule Confirmation Check #3 with a 2-second delay.
            Log::warning("Confirmation check #{$attempt} FAILED for domain #{$domain->id} ({$domain->url}). Scheduling Confirmation Check #3 in 2 seconds.", [
                'domain_id' => $domain->id,
                'attempt' => $attempt,
                'http_status' => $httpStatus,
                'failure_reason' => $failureReason,
            ]);

            \App\Jobs\ProcessUptimeConfirmationJob::dispatch(
                $domain->id,
                3,
                $httpStatus ?? $initialHttpStatus,
                $failureReason ?? $initialFailureReason,
                $source,
                $region,
                $location
            )->delay(now()->addSeconds(2));

            return;
        }

        // Check #3 also failed! All 3 checks have now failed. Confirm outage and mark DOWN!
        \Illuminate\Support\Facades\Cache::forget("domain_down_confirmation_{$domain->id}");

        Log::warning("All 3 confirmation checks FAILED for domain #{$domain->id} ({$domain->url}). Confirming domain DOWN.", [
            'domain_id' => $domain->id,
            'http_status' => $httpStatus,
            'failure_reason' => $failureReason,
        ]);

        $this->finalizeConfirmedDown(
            $domain,
            $httpStatus ?? $initialHttpStatus,
            $failureReason ?? $initialFailureReason,
            $durationMs,
            $source,
            $region,
            $location
        );
    }

    /**
     * Finalize marking a domain DOWN after 3 consecutive failed checks.
     */
    public function finalizeConfirmedDown(
        Domain $domain,
        ?int $httpStatus,
        ?string $failureReason,
        ?int $durationMs,
        string $source = 'local',
        string $region = 'local',
        string $location = 'local'
    ): void {
        $oldDomainStatus = $domain->status;
        $domain->status = 'down';
        $domain->last_response_status = $httpStatus ?? ($failureReason ?? 'Domain unreachable');
        $domain->last_response_time_ms = null;
        $domain->last_checked_at = \Illuminate\Support\Carbon::now();
        $domain->save();
        $domain->refresh();

        $incident = null;
        if ($this->incidentRecorder) {
            $latestIncident = Incident::where('domain_id', $domain->id)
                ->where('status', 'ongoing')
                ->orderByDesc('started_at')
                ->first();

            if (!$latestIncident) {
                $extraHeaders = [
                    'http_status' => $httpStatus,
                    'checked_at' => now()->toDateTimeString(),
                    'response_headers' => null,
                    'response_body' => null,
                    'duration_ms' => $durationMs,
                    'exception' => $failureReason,
                    'source' => $source,
                    'region' => $region,
                ];
                $incident = $this->incidentRecorder->recordIncident($domain, $extraHeaders);
            } else {
                $incident = $latestIncident;
            }
        }

        // Record status event
        try {
            DomainStatusEvent::create([
                'domain_id' => $domain->id,
                'status' => 'down',
                'response_time_ms' => null,
                'incident_id' => $incident?->id,
                'check_source' => $source,
                'checked_at' => now(),
                'http_status' => $httpStatus,
                'region' => $region,
                'location' => $location,
            ]);
        } catch (Throwable $e) {
            Log::warning('Failed to record domain status event in finalizeConfirmedDown', [
                'domain_id' => $domain->id,
                'error' => $e->getMessage(),
            ]);
        }

        // Begin Action Log
        $actionHandle = null;
        try {
            $actionMessage = $failureReason ? 'Domain is DOWN: ' . $failureReason : 'Domain is DOWN';
            $actionHandle = $this->systemLogs->beginAction([
                'workspace_id' => $domain->workspace_id,
                'domain_id' => $domain->id,
                'incident_id' => $incident?->id,
                'event_type' => SystemLogEventType::DOMAIN_UPTIME,
                'source' => $source === 'lambda' ? 'external-health-checker' : 'health-checker',
                'category' => 'monitoring.uptime',
                'trigger_source' => $source === 'lambda' ? 'external-uptime-monitor' : 'uptime-monitor',
                'message' => $actionMessage,
                'response_time_ms' => null,
                'error_message' => $failureReason ?? 'Domain unreachable',
                'payload' => [
                    'old_status' => $oldDomainStatus,
                    'new_status' => 'down',
                    'http_status' => $httpStatus,
                    'url' => $domain->url,
                    'status_changed' => true,
                    'incident_ulid' => $incident?->ulid,
                    'confirmed_checks' => 3,
                ],
                'actor' => $this->systemLogs->automationActor('health-checker'),
            ]);
        } catch (Throwable $e) {
            Log::error('Failed to create action log in finalizeConfirmedDown', [
                'domain_id' => $domain->id,
                'error' => $e->getMessage(),
            ]);
        }

        // Dispatch notifications and alerts
        try {
            $this->trackDownAlerts($domain, false, $actionHandle);
        } catch (Throwable $e) {
            Log::error('trackDownAlerts threw in finalizeConfirmedDown', [
                'domain_id' => $domain->id,
                'error' => $e->getMessage(),
            ]);
        }

        if (!$domain->isFirstHealthCheck()) {
            try {
                $this->notifyOnStatusChange($domain, $oldDomainStatus, $incident, $actionHandle);
            } catch (Throwable $e) {
                Log::error('notifyOnStatusChange threw in finalizeConfirmedDown', [
                    'domain_id' => $domain->id,
                    'error' => $e->getMessage(),
                ]);
            }

            DomainStatusUpdated::dispatch($domain, true, $actionHandle?->getParentId());
        }

        if ($actionHandle) {
            try {
                $actionHandle->complete([
                    'status' => 'completed',
                    'domain_status' => 'down',
                ]);
            } catch (Throwable $e) {
                Log::warning('Failed to complete action log in finalizeConfirmedDown', [
                    'domain_id' => $domain->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }
}
