<?php

namespace App\Http\Controllers;

use App\Enums\SystemLogEventType;
use App\Models\Domain;
use App\Models\DomainIntegration;
use App\Models\NotificationChannel;
use App\Models\User;
use App\Models\WorkspaceIntegration;
use App\Services\AuditLogService;
use App\Services\SystemLogService;
use App\Services\PlanLimitService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class CompanyIntegrationController extends Controller
{
    public function __construct(
        private readonly SystemLogService $systemLogs,
        private readonly AuditLogService $audit,
    ) {}

    /*
       LIST DOMAIN INTEGRATIONS
     */

    public function show($domain_id)
    {
        try {

            $id = Domain::where('ulid', $domain_id)->value('id');

            $user = Auth::user();
            if (!($user instanceof User) || !$user->currentWorkspace()) {
                return response()->json(['message' => !$user ? 'Unauthenticated' : 'User is not part of a workspace'], !$user ? 401 : 403);
            }

            // Automatically backfill any missing domain integrations
            $existingIntegrationIds = DomainIntegration::where('domain_id', $id)->pluck('integration_id')->toArray();
            $allIntegrations = \App\Models\Integration::all();

            $missingIntegrations = [];
            foreach ($allIntegrations as $integration) {
                if (!in_array($integration->id, $existingIntegrationIds)) {
                    $missingIntegrations[] = [
                        'domain_id' => $id,
                        'integration_id' => $integration->id,
                        'enabled' => true, // Default to true for newly backfilled integrations
                        'ulid' => strtolower((string) Str::ulid()),
                        'created_at' => now(),
                        'updated_at' => now(),
                    ];
                }
            }

            if (!empty($missingIntegrations)) {
                DomainIntegration::insert($missingIntegrations);
            }

            $integrations = DomainIntegration::query()
                ->where('domain_integrations.domain_id', $id)
                ->join('integrations', 'domain_integrations.integration_id', '=', 'integrations.id')
                ->with('integration')
                ->orderBy('integrations.position')
                ->select('domain_integrations.*')
                ->get();

            return response()->json(['data' => $integrations]);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Server error', 'error' => $e->getMessage()], 500);
        }
    }

    public function integrationWebhooks($domain_id, $integration_ulid): \Illuminate\Http\JsonResponse
    {
        try {

            $domain_id = Domain::where('ulid', $domain_id)->value('id');

            // Resolve domain_integration numeric id from ULID
            $integrationId = DomainIntegration::where('ulid', $integration_ulid)->value('id');

            $user = Auth::user();
            if (!($user instanceof User) || !$user->currentWorkspace()) {
                return response()->json(['message' => !$user ? 'Unauthenticated' : 'User is not part of a workspace'], !$user ? 401 : 403);
            }
            $webhooks = NotificationChannel::where('domain_id', $domain_id)
                ->where('workspace_id', $user->workspace_id)
                ->where('integration_id', $integrationId)
                ->with('domainIntegration.integration')
                ->orderBy('created_at', 'desc')
                ->get();
            return response()->json(['data' => $webhooks]);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Server error', 'error' => $e->getMessage()], 500);
        }
    }

    /*
       CREATE WEBHOOK
     */

    public function storeWebhook(Request $request, $domain_id)
    {
        try {

            $domain_id = Domain::where('ulid', $domain_id)->value('id');

            $user = Auth::user();
            if (!($user instanceof User)) {
                return response()->json(['message' => 'Unauthenticated'], 401);
            }
            $workspaceId = $user->currentWorkspaceId();
            if (!$workspaceId) {
                return response()->json(['message' => 'User not in workspace'], 422);
            }
            $urlRules = ['required', 'string'];
            $requestUrl = $request->input('url', '');
            if (!str_starts_with($requestUrl, 'telegram://') && !str_starts_with($requestUrl, 'clickup://')) {
                $urlRules[] = 'url';
            }

            $validated = $request->validate([
                'integration_ulid' => ['required', 'exists:domain_integrations,ulid'],
                'name' => ['required', 'string', 'max:255'],
                'url' => $urlRules,
                'events' => ['sometimes', 'array'],
                'events.*' => ['string'],
                'meta_json' => ['sometimes', 'array'],
            ]);

            $domainIntegration = DomainIntegration::with('integration')
                ->where('ulid', $validated['integration_ulid'])
                ->firstOrFail();

            // Check plan integration access
            $workspace = $user->currentWorkspace();
            $integrationKey = $domainIntegration->integration->key ?? null;
            $billingKey = self::mapIntegrationKeyToBilling($integrationKey);
            if ($billingKey && $workspace && !PlanLimitService::hasIntegration($workspace, $billingKey)) {
                return response()->json([
                    'message' => ucfirst($domainIntegration->integration->name ?? $integrationKey) . ' integration is not available on your current plan. Please upgrade your plan to use this integration.',
                ], 403);
            }

            $channel = NotificationChannel::create([
                'workspace_id' => $workspaceId,
                'domain_id' => $domain_id,
                'type' => $domainIntegration->integration->key,
                'integration_id' => $domainIntegration->id,
                'name' => $validated['name'],
                'url' => $validated['url'],
                'events' => $validated['events'] ?? ['Domain Up', 'Domain Down', 'SSL Expiring', 'SSL Expired'],
                'meta_json' => $validated['meta_json'] ?? null,
                'is_active' => true,
            ]);

            // Ensure domain integration is enabled when a webhook channel is added
            if (!$domainIntegration->enabled) {
                $domainIntegration->enabled = true;
                $domainIntegration->save();
            }

            // Send test notification
            $content = "[" . config('app.name') . "] Test notification at " . now();
            $success = false;
            $lastTriggerStatus = null;
            $testResponseStatus = null;
            $testResponseBody = null;
            try {
                $key = $domainIntegration->integration->key;
                if ($key === 'discord') {
                    $response = Http::post($channel->url, ['content' => $content]);
                    $testResponseStatus = $response->status();
                    $testResponseBody = $response->body();
                    $success = $response->successful();
                    $lastTriggerStatus = $success ? 'success' : ($response->status() . ' ' . $response->reason());
                } elseif ($key === 'slack') {
                    $response = Http::post($channel->url, ['text' => $content]);
                    $testResponseStatus = $response->status();
                    $testResponseBody = $response->body();
                    $success = $response->successful();
                    $lastTriggerStatus = $success ? 'success' : ($response->status() . ' ' . $response->reason());
                } elseif ($key === 'telegram') {
                    $botToken = config('services.telegram.bot_token');
                    $response = Http::post("https://api.telegram.org/bot{$botToken}/sendMessage", [
                        'chat_id' => $channel->url,
                        'text' => "✅ " . $content,
                    ]);
                    $testResponseStatus = $response->status();
                    $testResponseBody = $response->body();
                    $success = $response->successful();
                    $lastTriggerStatus = $success ? 'success' : ($response->status() . ' ' . $response->reason());
                }
            } catch (\Throwable $e) {
                $lastTriggerStatus = 'error: ' . $e->getMessage();
            } finally {
                $channel->last_triggered_at = now();
                $channel->last_trigger_status = $lastTriggerStatus;
                $channel->save();
                $success ? $channel->increment('success_count') : $channel->increment('failure_count');
            }
            $this->logChannelEvent(
                $user,
                $channel,
                SystemLogEventType::INTEGRATION_CHANNEL_CREATED,
                $success ? 'success' : 'warning',
                $success
                    ? $domainIntegration->integration->name . ' webhook created and test succeeded'
                    : $domainIntegration->integration->name . ' webhook created but test failed',
                [
                    'test_status' => $lastTriggerStatus,
                ],
                [
                    'test_request' => ['content' => $content],
                    'test_response_status' => $testResponseStatus,
                    'test_response_body' => $testResponseBody,
                ]
            );

            $this->audit->integrationChannelCreated($user, $channel, [
                'integration' => $domainIntegration->integration->name ?? null,
                'test_status' => $lastTriggerStatus,
            ]);

            return response()->json([
                'message' => "{$domainIntegration->integration->name} webhook added and test notification sent",
                'data' => $channel->fresh(),
            ], 201);
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage(), 'error' => 'Server error'], 500);
        }
    }

    /*
       DELETE WEBHOOK
     */

    public function destroyWebhook(string $webhook_ulid)
    {
        try {
            $user = Auth::user();
            if (!($user instanceof User)) {
                return response()->json(['message' => 'Unauthenticated'], 401);
            }
            $channel = NotificationChannel::where('workspace_id', $user->currentWorkspaceId())
                ->where('ulid', $webhook_ulid)
                ->first();
            if (!$channel) {
                return response()->json(['message' => 'Webhook not found'], 404);
            }
            $key = $channel->integration->key ?? 'webhook';
            $this->logChannelEvent(
                $user,
                $channel,
                SystemLogEventType::INTEGRATION_CHANNEL_DELETED,
                'success',
                ucfirst($key) . ' webhook removed'
            );
            $this->audit->integrationChannelDeleted($user, $channel);
            $channel->delete();
            return response()->json(['message' => ucfirst($key) . ' webhook removed']);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Server error', 'error' => $e->getMessage()], 500);
        }
    }

    /*
       TEST WEBHOOK (GENERIC)
     */

    public function test(Request $request, string $channel_ulid)
    {
        try {
            $user = $request->user();
            if (!($user instanceof User)) {
                return response()->json(['message' => 'Unauthenticated'], 401);
            }
            $channel = NotificationChannel::with('domainIntegration.integration')
                ->where('workspace_id', $user->workspace_id)
                ->where('ulid', $channel_ulid)
                ->first();
            if (!$channel) {
                return response()->json(['message' => 'Channel not found'], 404);
            }
            $content = "[" . config('app.name') . "] Test notification at " . now();
            $success = false;
            $lastTriggerStatus = null;
            $key = $channel->integration->key ?? null;
            $testResponseStatus = null;
            $testResponseBody = null;
            try {
                if ($key === 'discord') {
                    $response = Http::post($channel->url, ['content' => $content]);
                    $testResponseStatus = $response->status();
                    $testResponseBody = $response->body();
                    $success = $response->successful();
                    $lastTriggerStatus = $success ? 'success' : ($response->status() . ' ' . $response->reason());
                } elseif ($key === 'slack') {
                    $response = Http::post($channel->url, ['text' => $content]);
                    $testResponseStatus = $response->status();
                    $testResponseBody = $response->body();
                    $success = $response->successful();
                    $lastTriggerStatus = $success ? 'success' : ($response->status() . ' ' . $response->reason());
                } elseif ($key === 'telegram') {
                    $botToken = config('services.telegram.bot_token');
                    $response = Http::post("https://api.telegram.org/bot{$botToken}/sendMessage", [
                        'chat_id' => $channel->url,
                        'text' => "✅ " . $content,
                    ]);
                    $testResponseStatus = $response->status();
                    $testResponseBody = $response->body();
                    $success = $response->successful();
                    $lastTriggerStatus = $success ? 'success' : ($response->status() . ' ' . $response->reason());
                } elseif ($key === 'clickup') {
                    $config = $channel->meta_json ?? [];
                    $listId = $config['clickup_list_id'] ?? null;

                    if (!$listId) {
                        return response()->json(['message' => 'ClickUp list ID not configured'], 400);
                    }

                    $integration = \App\Models\UserIntegration::where('provider', 'clickup')
                        ->where('workspace_id', $user->workspace_id)
                        ->first();

                    if (!$integration || !$integration->access_token) {
                        return response()->json(['message' => 'ClickUp integration not connected'], 400);
                    }

                    $clickUpService = app(\App\Services\ClickUpService::class);
                    $taskData = [
                        'name' => 'Boomerr Test Task',
                        'description' => "✅ " . $content,
                        'tags' => ['boomerr', 'test'],
                        'priority' => $config['default_priority'] ?? 3,
                    ];

                    if (!empty($config['default_assignee'])) {
                        $taskData['assignees'] = [$config['default_assignee']];
                    }

                    $createdTask = $clickUpService->createTask($integration->access_token, $listId, $taskData);

                    $success = true;
                    $lastTriggerStatus = 'success';
                    $testResponseStatus = 200;
                    $testResponseBody = json_encode($createdTask);
                } else {
                    $lastTriggerStatus = 'unsupported';
                    return response()->json(['message' => 'Testing not supported'], 400);
                }
            } catch (\Throwable $e) {
                $lastTriggerStatus = 'error: ' . $e->getMessage();
                Log::warning('Integration test failed', [
                    'channel_id' => $channel->id,
                    'integration' => $key,
                    'error' => $e->getMessage(),
                ]);
            } finally {
                $channel->last_triggered_at = now();
                $channel->last_trigger_status = $lastTriggerStatus;
                $channel->save();
                $success ? $channel->increment('success_count') : $channel->increment('failure_count');
            }

            $this->logChannelEvent(
                $user,
                $channel,
                SystemLogEventType::WEBHOOK_TEST,
                $success ? 'success' : 'failure',
                $success ? 'Webhook test completed' : 'Webhook test failed',
                [
                    'test_status' => $lastTriggerStatus,
                    'channel_id' => $channel->id,
                ],
                [
                    'test_request' => ['content' => $content],
                    'test_response_status' => $testResponseStatus,
                    'test_response_body' => $testResponseBody,
                ]
            );
            return response()->json([
                'message' => 'Test message sent',
                'data' => $channel->fresh(),
            ]);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Server error', 'error' => $e->getMessage()], 500);
        }
    }

    /*
       UPDATE WEBHOOK
     */

    public function updateWebhook(string $webhook_ulid, Request $request)
    {
        try {
            $user = Auth::user();
            if (!($user instanceof User)) {
                return response()->json(['message' => 'Unauthenticated'], 401);
            }
            $channel = NotificationChannel::where('workspace_id', $user->workspace_id)
                ->where('ulid', $webhook_ulid)
                ->first();
            if (!$channel) {
                return response()->json(['message' => 'Channel not found'], 404);
            }
            $urlRules = ['sometimes', 'string'];
            if (!in_array($channel->type, ['telegram', 'clickup'])) {
                $urlRules[] = 'url';
            }

            $validated = $request->validate([
                'name' => ['sometimes', 'string'],
                'url' => $urlRules,
                'is_active' => ['sometimes', 'boolean'],
                'events' => ['sometimes', 'array'],
                'events.*' => ['string'],
                'meta_json' => ['sometimes', 'array'],
            ]);
            $channel->update($validated);
            $this->logChannelEvent(
                $user,
                $channel,
                SystemLogEventType::INTEGRATION_CHANNEL_UPDATED,
                'success',
                'Webhook updated',
                [
                    'changes' => $validated,
                ]
            );
            $changes = collect($validated)->map(function ($v, $k) use ($channel) {
                $originalValue = $channel->getOriginal($k);
                return [
                    'field' => $k,
                    'from' => $originalValue !== null ? (is_array($originalValue) ? json_encode($originalValue) : (string) $originalValue) : null,
                    'to' => $v !== null ? (is_array($v) ? json_encode($v) : (string) $v) : null,
                ];
            })->values()->all();

            $this->audit->integrationChannelUpdated($user, $channel, $changes);

            // Sync with Telegram if events were changed
            if ($channel->type === 'telegram' && isset($validated['events'])) {
                $originalEvents = is_string($channel->getOriginal('events'))
                    ? json_decode($channel->getOriginal('events'), true)
                    : $channel->getOriginal('events');

                $originalEvents = $originalEvents ?? [];

                // Check if arrays differ
                sort($originalEvents);
                $newEvents = $validated['events'];
                sort($newEvents);

                if ($originalEvents !== $newEvents) {
                    $telegramController = app(\App\Http\Controllers\TelegramIntegrationController::class);
                    \App\Services\TelegramNotifier::send($channel->url, [
                        'text' => "⚙️ <b>Alert Preferences Updated</b>\n\nYour alert preferences were just updated from the web dashboard. Here are your new settings:",
                        'parse_mode' => 'HTML',
                        'reply_markup' => $telegramController->buildSettingsKeyboard($channel),
                    ], $channel->id);
                }
            }
            return response()->json([
                'message' => 'Webhook updated',
                'data' => $channel->fresh(),
            ]);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Server error', 'error' => $e->getMessage()], 500);
        }
    }

    public function getWebhook(string $webhook_ulid)
    {
        try {
            $user = Auth::user();
            if (!($user instanceof User)) {
                return response()->json(['message' => 'Unauthenticated'], 401);
            }

            $channel = NotificationChannel::where('workspace_id', $user->currentWorkspaceId())
                ->where('ulid', $webhook_ulid)
                ->first();

            if (!$channel) {
                return response()->json(['message' => 'Not found'], 404);
            }

            return response()->json(['data' => $channel]);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Server error', 'error' => $e->getMessage()], 500);
        }
    }

    public function updateDomainIntegration(string $integration_ulid, Request $request)
    {
        try {
            $user = Auth::user();
            if (!($user instanceof User)) {
                return response()->json(['message' => 'Unauthenticated'], 401);
            }
            $integration = DomainIntegration::with(['integration', 'domain'])->where('ulid', $integration_ulid)->first();
            if (!$integration) {
                return response()->json(['message' => 'Integration not found'], 404);
            }
            $validated = $request->validate([
                'enabled' => ['sometimes', 'boolean'],
            ]);

            // Check plan integration access when enabling
            if (!empty($validated['enabled'])) {
                $workspace = $user->currentWorkspace();
                $integrationKey = $integration->integration->key ?? null;
                $billingKey = self::mapIntegrationKeyToBilling($integrationKey);
                if ($billingKey && $workspace && !PlanLimitService::hasIntegration($workspace, $billingKey)) {
                    return response()->json([
                        'message' => ucfirst($integration->integration->name ?? $integrationKey) . ' integration is not available on your current plan. Please upgrade your plan to use this integration.',
                    ], 403);
                }
            }

            // Capture original value before update
            $wasEnabled = $integration->enabled;

            $integration->update($validated);

            $this->logIntegrationToggle(
                $user,
                $integration,
                'success',
                'Domain integration updated',
                $validated
            );

            if (isset($validated['enabled'])) {
                $this->audit->domainIntegrationToggled($user, $integration, (bool) $validated['enabled'], $wasEnabled);
            }

            return response()->json([
                'message' => 'Integration updated',
                'data' => $integration->fresh(),
            ]);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Server error', 'error' => $e->getMessage()], 500);
        }
    }

    public function workspaceIntegrations()
    {
        try {
            $user = Auth::user();
            if (!($user instanceof User)) {
                return response()->json(['message' => 'Unauthenticated'], 401);
            }
            $workspaceId = $user->workspace_id;

            // Automatically backfill any missing workspace integrations
            $existingIntegrationIds = WorkspaceIntegration::where('workspace_id', $workspaceId)->pluck('integration_id')->toArray();
            $allIntegrations = \App\Models\Integration::all();

            $missingIntegrations = [];
            foreach ($allIntegrations as $integration) {
                if (!in_array($integration->id, $existingIntegrationIds)) {
                    $missingIntegrations[] = [
                        'workspace_id' => $workspaceId,
                        'integration_id' => $integration->id,
                        'enabled' => true,
                        'ulid' => strtolower((string) Str::ulid()),
                        'created_at' => now(),
                        'updated_at' => now(),
                    ];
                }
            }

            if (!empty($missingIntegrations)) {
                WorkspaceIntegration::insert($missingIntegrations);
            }

            $integrations = WorkspaceIntegration::where('workspace_id', $workspaceId)
                ->with('integration')
                ->join('integrations', 'workspace_integrations.integration_id', '=', 'integrations.id')
                ->orderBy('integrations.position')
                ->select('workspace_integrations.*')
                ->get();

            $payload = $integrations->map(function ($i) {
                $arr = $i->toArray();
                if (empty($arr['ulid'])) {
                    $arr['ulid'] = (string) ($i->id ?? null);
                }
                return $arr;
            });

            return response()->json([
                'message' => 'Workspace integrations retrieved',
                'data' => $payload,
            ]);
        } catch (\Throwable $e) {
            Log::error('CompanyIntegrationController workspaceIntegrations failed: ' . $e->getMessage());
            return response()->json(['message' => 'Server error', 'error' => $e->getMessage()], 500);
        }
    }

    public function updateWorkspaceIntegration(string $workspace_integration_ulid, Request $request)
    {
        try {
            $user = Auth::user();
            if (!($user instanceof User)) {
                return response()->json(['message' => 'Unauthenticated'], 401);
            }
            $query = WorkspaceIntegration::with('integration');
            if (Str::isUlid($workspace_integration_ulid)) {
                $integration = $query->where('ulid', $workspace_integration_ulid)->first();
            } else {
                $integration = $query->find((int) $workspace_integration_ulid);
            }
            if (!$integration) {
                return response()->json(['message' => 'Integration not found'], 404);
            }
            $validated = $request->validate([
                'enabled' => ['sometimes', 'boolean'],
            ]);

            $integration->update($validated);

            $this->logWorkspaceIntegration(
                $user,
                $integration,
                'success',
                'Workspace integration updated',
                $validated
            );

            if (isset($validated['enabled'])) {
                $this->audit->workspaceIntegrationToggled($user, $integration, (bool) $validated['enabled']);
            }

            return response()->json([
                'message' => 'Integration updated',
                'data' => $integration->fresh(),
            ]);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Server error', 'error' => $e->getMessage()], 500);
        }
    }

    private function logChannelEvent(
        User $actor,
        NotificationChannel $channel,
        SystemLogEventType $eventType,
        string $status,
        string $message,
        array $payload = [],
        array $sensitive = []
    ): void {
        try {
            $channel->loadMissing('domainIntegration.integration');

            $this->systemLogs->recordInline([
                'workspace_id' => $channel->workspace_id,
                'domain_id' => $channel->domain_id,
                'domain_integration_id' => $channel->integration_id,
                'notification_channel_id' => $channel->id,
                'integration_id' => $channel->domainIntegration?->integration_id,
                'event_type' => $eventType,
                'source' => 'integration-controller',
                'status' => $status,
                'message' => $message,
                'payload' => array_merge([
                    'channel' => [
                        'id' => $channel->id,
                        'name' => $channel->name,
                        'type' => $channel->type,
                    ],
                ], $payload),
                'sensitive_payload' => empty($sensitive) ? null : $sensitive,
                'actor' => $actor,
            ]);
        } catch (\Throwable $e) {
            Log::error('CompanyIntegrationController logChannelEvent failed: ' . $e->getMessage());
        }
    }

    private function logIntegrationToggle(User $actor, DomainIntegration $integration, string $status, string $message, array $payload = []): void
    {
        try {
            $integration->loadMissing('domain');

            $this->systemLogs->recordInline([
                'workspace_id' => $integration->domain?->workspace_id,
                'domain_id' => $integration->domain_id,
                'domain_integration_id' => $integration->id,
                'integration_id' => $integration->integration_id,
                'event_type' => SystemLogEventType::INTEGRATION_CHANNEL_UPDATED,
                'source' => 'integration-controller',
                'status' => $status,
                'message' => $message,
                'payload' => array_merge([
                    'integration_id' => $integration->integration_id,
                    'enabled' => (bool) $integration->enabled,
                ], $payload),
                'actor' => $actor,
            ]);
        } catch (\Throwable $e) {
            Log::error('CompanyIntegrationController logIntegrationToggle failed: ' . $e->getMessage());
        }
    }

    private function logWorkspaceIntegration(User $actor, WorkspaceIntegration $integration, string $status, string $message, array $payload = []): void
    {
        try {
            $integration->loadMissing('integration');

            $this->systemLogs->recordInline([
                'workspace_id' => $integration->workspace_id,
                'integration_id' => $integration->integration_id,
                'event_type' => SystemLogEventType::INTEGRATION_CHANNEL_UPDATED,
                'source' => 'integration-controller',
                'status' => $status,
                'message' => $message,
                'payload' => array_merge([
                    'integration_id' => $integration->integration_id,
                    'integration_key' => $integration->integration?->key,
                    'enabled' => (bool) $integration->enabled,
                ], $payload),
                'actor' => $actor,
            ]);
        } catch (\Throwable $e) {
            Log::error('CompanyIntegrationController logWorkspaceIntegration failed: ' . $e->getMessage());
        }
    }

    /**
     * Maps database integration key to billing plan integration key.
     */
    private static function mapIntegrationKeyToBilling(?string $key): ?string
    {
        try {
            $map = [
                'discord' => 'discord',
                'slack' => 'slack',
                'whatsapp' => 'whatsapp',
                'sms' => 'sms',
                'email' => 'email',
                'call' => 'calls',
                'telegram' => 'telegram',
                'facebook-ads' => 'facebook_ads',
                'google-ads' => 'google_ads',
            ];

            return $map[$key] ?? null;
        } catch (\Throwable $e) {
            Log::error('CompanyIntegrationController mapIntegrationKeyToBilling failed: ' . $e->getMessage());
            return null;
        }
    }
}
