<?php

namespace App\Queries;

use App\Models\DomainStatusEvent;
use App\Models\SystemLog;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;

class SystemLogQuery
{
    public const EXCLUDED_EVENT_TYPES = [
        'domain.created',
        'domain.updated',
        'domain.deleted',
        'webhook.test',
        'webhook.dispatch',
        'integration.channel.created',
        'integration.channel.updated',
        'integration.channel.deleted',
    ];

    public const ROLE_FILTERED_INTEGRATIONS = ['whatsapp', 'email', 'call', 'sms'];

    public static function base(User $user, Request $request, ?int $incidentId = null): Builder
    {
        $workspaceId = $user->currentWorkspaceId();
        $userRole = $user->roleInWorkspace($workspaceId) ?? 'member';

        $latestResponseSubquery = DomainStatusEvent::select('response_time_ms')
            ->whereColumn('domain_status_events.domain_id', 'system_logs.domain_id')
            ->orderByDesc('domain_status_events.created_at')
            ->limit(1);

        $query = SystemLog::query()
            ->select('system_logs.*')
            ->selectSub($latestResponseSubquery, 'latest_response_time_ms')
            ->where('workspace_id', $workspaceId)
            ->parents()
            ->whereNotIn('event_type', self::EXCLUDED_EVENT_TYPES)
            ->when($incidentId, fn($q) => $q->where('incident_id', $incidentId))
            ->where(function (Builder $builder) {
                $builder->where('log_type', SystemLog::LOG_TYPE_ACTION)
                    ->orWhereNull('integration_id')
                    ->orWhereHas('integration', fn($i) => $i->where('is_launched', true));
            });

        self::applyFilters($query, $request);
        self::applyRoleBasedFiltering($query, $user, $userRole);
        self::applyDateFilters($query, $request);
        self::applySearchFilter($query, $request);

        return $query->with(self::relations())->orderByDesc('occurred_at');
    }

    /* ---------------- Filters ---------------- */

    private static function applyFilters(Builder $query, Request $request): void
    {
        $query
            ->when(
                $request->filled('domain_id'),
                fn($q) => $q->where('domain_id', (int) $request->input('domain_id'))
            )
            ->when(
                $request->filled('notification_channel_id'),
                fn($q) => $q->where('notification_channel_id', (int) $request->input('notification_channel_id'))
            )
            ->when(
                $request->filled('status'),
                fn($q) => $q->whereIn('status', Arr::wrap($request->input('status')))
            )
            ->when(
                $request->filled('execution_status'),
                fn($q) => $q->whereIn('execution_status', Arr::wrap($request->input('execution_status')))
            )
            ->when(
                $request->filled('event_type'),
                fn($q) => $q->whereIn('event_type', Arr::wrap($request->input('event_type')))
            )
            ->when($request->filled('integration_key'), function ($q) use ($request) {
                $keys = Arr::wrap($request->input('integration_key'));
                $q->where(function ($b) use ($keys) {
                    $b->whereIn('integration_key', $keys)
                        ->orWhereHas('children', fn($c) => $c->whereIn('integration_key', $keys));
                });
            });
    }

    private static function applyDateFilters(Builder $builder, Request $request): void
    {
        if ($request->filled('from')) {
            if ($from = self::parseDate($request->input('from'))) {
                $builder->where('occurred_at', '>=', $from);
            }
        }

        if ($request->filled('to')) {
            if ($to = self::parseDate($request->input('to'))) {
                $builder->where('occurred_at', '<=', $to);
            }
        }
    }

    private static function applySearchFilter(Builder $builder, Request $request): void
    {
        if (! $request->filled('search')) return;

        $term = '%' . strtolower($request->string('search')) . '%';

        $builder->where(function ($inner) use ($term) {
            $inner->whereRaw('LOWER(message) LIKE ?', [$term])
                ->orWhereRaw('LOWER(actor_name) LIKE ?', [$term])
                ->orWhereRaw('LOWER(actor_email) LIKE ?', [$term])
                ->orWhereRaw('LOWER(event_type) LIKE ?', [$term])
                ->orWhere('correlation_id', 'like', '%' . trim($term, '%') . '%');
        });
    }

    private static function parseDate(?string $value): ?string
    {
        try {
            return $value ? Carbon::parse($value)->toDateTimeString() : null;
        } catch (\Throwable) {
            return null;
        }
    }

    /* ---------------- Role Filtering ---------------- */

    private static function applyRoleBasedFiltering(
        Builder $query,
        User $user,
        string $userRole
    ): void {
        if ($userRole === 'owner') return;

        $query->where(function ($builder) use ($user, $userRole) {

            $builder->where('log_type', SystemLog::LOG_TYPE_ACTION)
                ->orWhereHas(
                    'integration',
                    fn($q) =>
                    $q->whereNotIn('key', self::ROLE_FILTERED_INTEGRATIONS)
                )

                ->orWhere(function ($roleFiltered) use ($user, $userRole) {

                    $roleFiltered->whereHas(
                        'integration',
                        fn($q) =>
                        $q->whereIn('key', self::ROLE_FILTERED_INTEGRATIONS)
                    );

                    if ($userRole === 'member') {
                        $roleFiltered->where('actor_id', $user->id);
                    } elseif ($userRole === 'admin') {
                        $roleFiltered->whereIn('actor_role', ['member', 'admin']);
                    }
                })

                ->orWhereNull('integration_id');
        });
    }

    /* ---------------- Relations ---------------- */

    private static function relations(): array
    {
        return [

            'children' => fn($q) => $q->orderBy('triggered_at')->select([
                'id',
                'parent_id',
                'workspace_id',
                'domain_id',
                'notification_channel_id',
                'integration_id',
                'log_type',
                'integration_key',
                'event_type',
                'source',
                'status',
                'execution_status',
                'message',
                'response_time_ms',
                'error_code',
                'error_message',
                'integration_metadata',
                'payload',
                'triggered_at',
                'completed_at',
                'occurred_at',
                'actor_name',
                'actor_email',
            ]),

            'children.notificationChannel:id,name,type,url,is_active,last_trigger_status',
            'children.integration:id,name,key,is_launched',

            'domain:id,name,url',

            'domain.domainIntegrations' => fn($q) =>
            $q->whereHas('integration', fn($i) => $i->where('is_launched', true))
                ->select('id', 'domain_id', 'integration_id', 'enabled'),

            'domain.domainIntegrations.integration' => fn($q) =>
            $q->where('is_launched', true)->select('id', 'name', 'key', 'is_launched'),

            'domain.domainIntegrations.notificationChannels:id,domain_id,integration_id,name,type,url,is_active,last_trigger_status',

            'domain.notificationChannels:id,domain_id,integration_id,name,type,url,is_active,last_trigger_status',

            'notificationChannel:id,name,type,url,is_active,last_trigger_status',

            'integration' => fn($q) =>
            $q->where('is_launched', true)->select('id', 'name', 'key', 'is_launched'),

            'workspace:id,name',

            'domainIntegration' => fn($q) =>
            $q->whereHas('integration', fn($i) => $i->where('is_launched', true))
                ->select('id', 'domain_id', 'integration_id', 'enabled'),

            'domainIntegration.integration' => fn($q) =>
            $q->where('is_launched', true)->select('id', 'name', 'key', 'is_launched'),

            'domainIntegration.notificationChannels:id,domain_id,integration_id,name,type,url,is_active,last_trigger_status',

            'actor:id,name,email',
        ];
    }
}
