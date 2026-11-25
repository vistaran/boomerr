<?php

namespace App\Http\Controllers;

use App\Events\DomainDeleted;
use App\Events\DomainUpdated;
use App\Jobs\RunDomainHealthChecks;
use App\Models\Domain;
use App\Models\DomainIntegration;
use App\Models\Integration;
use App\Models\NotificationChannel;
use App\Models\SystemLog;
use App\Models\User;
use App\Services\AuditLogService;
use App\Services\DomainCacheService;
use App\Services\DomainChangeNotifier;
use App\Services\PlanLimitService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use PHPUnit\Event\Telemetry\System;
use Throwable;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class DomainController extends Controller
{
    public function __construct(
        private readonly DomainCacheService $domainCache,
        private readonly AuditLogService $audit,
    ) {}

    private function authUser(Request $request): User
    {
        try {
            $user = $request->user();
            if (! $user instanceof User) {
                abort(401, 'Unauthenticated.');
            }
            return $user;
        } catch (Throwable $e) {
            Log::error('Auth user failed', ['error' => $e->getMessage()]);
            abort(401, 'Unauthenticated.');
        }
    }

    private function workspaceId(User $user): int
    {
        try {
            $workspaceId = (int) ($user->currentWorkspaceId() ?? 0);
            if (! $workspaceId) {
                abort(422, 'Authenticated user does not belong to a workspace.');
            }
            return $workspaceId;
        } catch (Throwable $e) {
            Log::error('Get workspace ID failed', ['error' => $e->getMessage()]);
            abort(422, 'Authenticated user does not belong to a workspace.');
        }
    }

    public function index(Request $request): JsonResponse
    {
        try {
            $user = $this->authUser($request);
            $workspaceId = $this->workspaceId($user);

            $domains = $this->domainCache->rememberCompanyDomains(
                $workspaceId,
                fn() => Domain::where('workspace_id', $workspaceId)
                    ->with('latestIncident')
                    ->orderBy('id')
                    ->get()
                    ->map(function (Domain $domain) {
                        $data = $domain->toArray();
                        $data['latest_incident'] = $data['latest_incident'] ?? null;
                        return $data;
                    })
                    ->all()
            );

            $workspace = $user->currentWorkspace();
            $isPastDue = $workspace && $workspace->isPastDue();

            return response()->json([
                'data' => $domains,
                'subscription_past_due' => $isPastDue,
                'message' => $isPastDue ? 'Your subscription payment is overdue. Features are limited to the free plan.' : null,
            ]);
        } catch (Throwable $e) {
            Log::error('Domain index failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Failed to load domains'], 500);
        }
    }

    public function store(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'name'           => ['required', 'string', 'max:255'],
                'url'            => ['required', 'url', 'max:255'],
                'label'          => ['nullable', 'string', 'max:255'],
                'environment'    => ['nullable', 'string', 'max:50'],
                'is_active'      => ['nullable', 'boolean'],
                'check_interval' => ['nullable', 'integer', 'min:1'],
            ]);

            // SSRF Guard
            \App\Helpers\SecurityHelper::validateUrl($validated['url']);

            $user = $this->authUser($request);
            $workspaceId = $this->workspaceId($user);
            $workspace = $user->currentWorkspace();

            // Check if workspace subscription is past due
            if ($workspace && $workspace->isPastDue()) {
                return response()->json([
                    'message' => 'Your subscription payment is overdue. Please resolve the payment issue to continue adding monitors.',
                    'error_code' => 'subscription_past_due',
                ], 403);
            }

            $isActive = $validated['is_active'] ?? true;

            // Enforce plan monitor limit
            if ($isActive && $workspace && ! PlanLimitService::canAddMonitor($workspace)) {
                $limits = PlanLimitService::getLimits($workspace);
                return response()->json([
                    'message'    => 'You have reached the maximum number of monitors allowed on your current plan.',
                    'limit'      => $limits['max_monitors'] ?? 0,
                    'error_code' => 'plan_limit_monitors',
                ], 403);
            }

            // Enforce minimum check interval from plan
            $minPlanInterval = $workspace ? PlanLimitService::getMonitorIntervalMinutes($workspace) : 1;
            if (isset($validated['check_interval']) && $validated['check_interval'] < $minPlanInterval) {
                return response()->json([
                    'message'    => "The minimum check interval for your plan is {$minPlanInterval} minutes.",
                    'error_code' => 'plan_min_interval_violation',
                ], 422);
            }

            // Resolve redirects to get the final URL
            $finalUrl = $validated['url'];
            try {
                $response = Http::timeout(5)->withOptions([
                    'allow_redirects' => ['strict' => true, 'max' => 3],
                    'verify' => false,
                ])->get($finalUrl);
                
                if ($response->handlerStats() && !empty($response->handlerStats()['url'])) {
                    $finalUrl = rtrim($response->handlerStats()['url'], '/');
                }
            } catch (Throwable $e) {
                // Keep original if request fails
            }
            $validated['url'] = $finalUrl;

            if (
                Domain::where('workspace_id', $workspaceId)
                ->where('url', $validated['url'])
                ->exists()
            ) {
                return response()->json([
                    'message' => 'A domain already exists for this workspace.',
                ], 409);
            }

            $checkInterval = isset($validated['check_interval']) ? max((int) $validated['check_interval'], $minPlanInterval) : $minPlanInterval;

            $domain = Domain::create([
                'workspace_id'   => $workspaceId,
                'name'           => $validated['name'],
                'url'            => $validated['url'],
                'label'          => $validated['label'] ?? null,
                'environment'    => $validated['environment'] ?? 'production',
                'is_active'      => $isActive,
                'paused_reason'  => $isActive ? null : 'user',
                'check_interval' => $checkInterval,
                'next_check_at'  => $isActive ? now()->addMinutes($checkInterval) : null,
                'status'         => 'unknown',
            ]);

            // Dispatch DomainCreated so webhooks get triggered
            try {
                \App\Events\DomainCreated::dispatch($domain);
            } catch (Throwable $e) {
                Log::warning('Failed to dispatch DomainCreated event', ['error' => $e->getMessage()]);
            }

            if ($isActive) {
                try {
                    dispatch(new RunDomainHealthChecks($domain, true));
                } catch (Throwable $e) {
                    Log::warning('Failed to dispatch RunDomainHealthChecks', ['error' => $e->getMessage()]);
                }
            }

            try {
                app(DomainChangeNotifier::class)
                    ->notify('created', $domain->load('company'), [], $user);
            } catch (Throwable $e) {
                Log::warning('Failed to notify domain change', ['error' => $e->getMessage()]);
            }

            try {
                Integration::query()->pluck('id')->each(
                    fn($id) => $domain->integrations()->attach($id, ['enabled' => true, 'ulid' => strtolower((string) Str::ulid())])
                );
            } catch (Throwable $e) {
                Log::warning('Failed to attach integrations', ['error' => $e->getMessage()]);
            }

            try {
                $this->audit->domainCreated($user, $domain);
            } catch (Throwable $e) {
                Log::warning('Failed to record audit domainCreated', ['error' => $e->getMessage()]);
            }

            try {
                \App\Models\Admin::all()->each(function ($admin) use ($domain, $user) {
                    $admin->notify(new \App\Notifications\AdminDomainEventNotification(
                        "User '{$user->name}' added a new domain: {$domain->name} ({$domain->url})", 
                        'add'
                    ));
                });
            } catch (Throwable $e) {
                Log::warning('Failed to notify admins of domain created', ['error' => $e->getMessage()]);
            }

            // Trigger: Hit 80% of monitor limit -> Upgrade CTA
            try {
                $limits = PlanLimitService::getLimits($workspace);
                $maxMonitors = $limits['max_monitors'] ?? 0;
                $currentMonitors = Domain::where('workspace_id', $workspaceId)->count();
                
                if ($maxMonitors > 0 && $currentMonitors == (int) floor($maxMonitors * 0.8)) {
                    if (!\App\Models\EmailDelivery::where('user_id', $user->id)->where('event_name', 'behavioral_80_percent_limit')->exists()) {
                        \Illuminate\Support\Facades\Mail::to($user->email)->send(new \App\Mail\Onboarding\UpgradeCtaEmail($user));
                        \App\Models\EmailDelivery::create([
                            'user_id' => $user->id,
                            'event_name' => 'behavioral_80_percent_limit',
                            'email' => $user->email,
                            'status' => 'sent',
                            'sent_at' => now()
                        ]);
                    }
                }
            } catch (Throwable $e) {
                Log::warning('Failed to process upgrade CTA email check', ['error' => $e->getMessage()]);
            }

            return response()->json([
                'message' => 'Domain created successfully',
                'data' => $domain,
            ], 201);
        } catch (ValidationException $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'errors' => $e->errors(),
            ], 422);
        } catch (Throwable $e) {
            Log::error('Domain create failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Failed to create domain'], 500);
        }
    }

    public function update(Request $request, string $domain_ulid): JsonResponse
    {
        try {
            $user = $this->authUser($request);
            $workspaceId = $this->workspaceId($user);

            $domain = Domain::where('workspace_id', $workspaceId)
                ->where('ulid', $domain_ulid)
                ->first();
            if (! $domain) {
                return response()->json(['message' => 'Domain not found'], 404);
            }

            $validated = $request->validate([
                'name'           => ['sometimes', 'required', 'string', 'max:255'],
                'url'            => ['sometimes', 'required', 'url', 'max:255'],
                'label'          => ['sometimes', 'nullable', 'string', 'max:255'],
                'environment'    => ['sometimes', 'nullable', 'string', 'max:50'],
                'is_active'      => ['sometimes', 'required', 'boolean'],
                'paused_reason'  => ['sometimes', 'nullable', 'string', 'in:user,plan_limit'],
                'check_interval' => ['sometimes', 'nullable', 'integer', 'min:1'],
            ]);

            if (array_key_exists('is_active', $validated) || array_key_exists('paused_reason', $validated)) {
                $targetActive = array_key_exists('is_active', $validated)
                    ? (bool) $validated['is_active']
                    : ($validated['paused_reason'] === null);

                if ($targetActive) {
                    $workspace = $user->currentWorkspace();
                    $maxMonitors = $workspace ? (PlanLimitService::getLimits($workspace)['max_monitors'] ?? 10) : 10;
                    if ($maxMonitors !== null) {
                        $activeCount = Domain::where('workspace_id', $workspaceId)
                            ->where('is_active', true)
                            ->where('id', '!=', $domain->id)
                            ->count();

                        if ($activeCount >= $maxMonitors) {
                            return response()->json([
                                'message'    => 'You have reached the maximum number of active monitors allowed on your current plan.',
                                'limit'      => $maxMonitors,
                                'error_code' => 'plan_limit_monitors',
                            ], 403);
                        }
                    }

                    $validated['is_active'] = true;
                    $validated['paused_reason'] = null;
                    if (!$domain->is_active || $domain->next_check_at === null) {
                        $domain->scheduleNextCheck();
                        $validated['next_check_at'] = $domain->next_check_at;
                    }
                } else {
                    $validated['is_active'] = false;
                    $validated['paused_reason'] = $validated['paused_reason'] ?? 'user';
                    $validated['next_check_at'] = null;
                    $domain->next_check_at = null;
                }
            }

            if (isset($validated['check_interval'])) {
                $workspace = $user->currentWorkspace();
                $minPlanInterval = $workspace ? PlanLimitService::getMonitorIntervalMinutes($workspace) : 1;
                if ($validated['check_interval'] < $minPlanInterval) {
                    return response()->json([
                        'message'    => "The minimum check interval for your plan is {$minPlanInterval} minutes.",
                        'error_code' => 'plan_min_interval_violation',
                    ], 422);
                }
            }

            if (isset($validated['url'])) {
                $finalUrl = $validated['url'];
                try {
                    $response = Http::timeout(5)->withOptions([
                        'allow_redirects' => ['strict' => true, 'max' => 3],
                        'verify' => false,
                    ])->get($finalUrl);
                    
                    if ($response->handlerStats() && !empty($response->handlerStats()['url'])) {
                        $finalUrl = rtrim($response->handlerStats()['url'], '/');
                    }
                } catch (Throwable $e) {
                    // Keep original if request fails
                }
                $validated['url'] = $finalUrl;
            }

            $original = $domain->only(array_keys($validated));
            $domain->update($validated);

            if (isset($validated['check_interval']) && $domain->is_active) {
                $domain->scheduleNextCheck();
                $domain->save();
            }

            if ($domain->is_active) {
                dispatch(new RunDomainHealthChecks($domain, false));
            }

            $changes = collect($validated)->map(function ($_, $field) use ($domain, $original) {
                return $original[$field] != $domain->{$field}
                    ? ['field' => $field, 'before' => $original[$field], 'after' => $domain->{$field}]
                    : null;
            })->filter()->values()->all();

            try {
                app(DomainChangeNotifier::class)
                    ->notify('updated', $domain->load('company'), $changes, $user);
            } catch (Throwable $e) {
                Log::warning('Failed to notify domain update', ['error' => $e->getMessage()]);
            }

            try {
                DomainUpdated::dispatch($domain);
            } catch (Throwable $e) {
                Log::warning('Failed to dispatch DomainUpdated event', ['error' => $e->getMessage()]);
            }

            try {
                $auditChanges = collect($changes)->map(fn($c) => [
                    'field' => $c['field'],
                    'from' => (string) ($c['before'] ?? ''),
                    'to' => (string) ($c['after'] ?? ''),
                ])->all();
                $this->audit->domainUpdated($user, $domain, $auditChanges);
            } catch (Throwable $e) {
                Log::warning('Failed to record audit domainUpdated', ['error' => $e->getMessage()]);
            }

            return response()->json([
                'message' => 'Domain updated successfully',
                'data' => $domain,
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'errors' => $e->errors(),
            ], 422);
        } catch (Throwable $e) {
            Log::error('Domain update failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Failed to update domain'], 500);
        }
    }

    public function destroy(Request $request, string $domain_ulid): JsonResponse
    {
        try {
            $user = $this->authUser($request);
            $workspaceId = $this->workspaceId($user);

            $domain = Domain::where('workspace_id', $workspaceId)
                ->select('id', 'workspace_id', 'name', 'url', 'ulid')
                ->where('ulid', $domain_ulid)
                ->first();

            if (! $domain) {
                return response()->json(['message' => 'Domain not found'], 404);
            }

            $systemLogs = SystemLog::where('domain_id', $domain->id)->update([
                'domain_id' => null
            ]);

            DomainIntegration::where('domain_id', $domain->id)->delete();
            NotificationChannel::where('domain_id', $domain->id)->delete();

            $snapshot = clone $domain;
            $domain->delete();

            try {
                app(DomainChangeNotifier::class)
                    ->notify('deleted', $snapshot, [], $user);
            } catch (Throwable $e) {
                Log::warning('Failed to notify domain deletion', ['error' => $e->getMessage()]);
            }

            try {
                DomainDeleted::dispatch($snapshot);
            } catch (Throwable $e) {
                Log::warning('Failed to dispatch DomainDeleted event', ['error' => $e->getMessage()]);
            }

            try {
                $this->audit->domainDeleted($user, $snapshot);
            } catch (Throwable $e) {
                Log::warning('Failed to record audit domainDeleted', ['error' => $e->getMessage()]);
            }

            try {
                \App\Models\Admin::all()->each(function ($admin) use ($snapshot, $user) {
                    $admin->notify(new \App\Notifications\AdminDomainEventNotification(
                        "User '{$user->name}' deleted domain: {$snapshot->name} ({$snapshot->url})", 
                        'delete'
                    ));
                });
            } catch (Throwable $e) {
                Log::warning('Failed to notify admins of domain deletion', ['error' => $e->getMessage()]);
            }

            return response()->json(['message' => 'Domain deleted successfully']);
        } catch (Throwable $e) {
            Log::error('Domain delete failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Failed to delete domain'], 500);
        }
    }

    public function fetchTitle(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'url' => ['required', 'url', 'max:255'],
            ]);

            // SSRF Guard
            \App\Helpers\SecurityHelper::validateUrl($validated['url']);

            $safeResult = \App\Helpers\SecurityHelper::executeSafeRequest($validated['url'], [
                'method' => 'GET',
                'timeout' => 5,
                'max_redirects' => 3,
                'verify_ssl' => false,
                'user_agent' => 'BoomerrBot/1.0',
            ]);

            if ($safeResult['http_code'] < 200 || $safeResult['http_code'] >= 400) {
                return response()->json(['title' => null]);
            }

            $html = $safeResult['body'];

            if (preg_match('/<title[^>]*>(.*?)<\/title>/is', $html, $m)) {
                return response()->json([
                    'title' => trim(html_entity_decode($m[1], ENT_QUOTES | ENT_HTML5)),
                ]);
            }

            return response()->json([
                'title' => parse_url($validated['url'], PHP_URL_HOST),
            ]);
        } catch (Throwable $e) {
            Log::warning('Fetch title failed', ['error' => $e->getMessage()]);
            return response()->json(['title' => null]);
        }
    }
}
