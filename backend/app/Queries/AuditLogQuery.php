<?php

namespace App\Queries;

use App\Models\AuditLog;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

class AuditLogQuery
{
    public static function base(User $user, Request $request): Builder
    {
        $workspaceId = $user->currentWorkspaceId();
        if (! $workspaceId) {
            $workspaceId = $user->currentWorkspace(true)?->id;
        }

        $query = AuditLog::query()
            ->where('workspace_id', $workspaceId);

        // Role-based filtering
        self::applyRoleBasedFilter($query, $user, (int) $workspaceId);

        self::applyFilters($query, $request);
        self::applyDateFilters($query, $request);
        self::applySearchFilter($query, $request);

        return $query->orderByDesc('occurred_at');
    }

    private static function applyRoleBasedFilter(Builder $query, User $user, int $workspaceId): void
    {
        $userRole = $user->roleInWorkspace($workspaceId) ?? $user->role ?? User::ROLE_MEMBER;

        if ($userRole === User::ROLE_OWNER || $userRole === User::ROLE_ADMIN) {
            // Owner and Admin can see all audit logs in the workspace
            return;
        }

        // Member can see all workspace operational audit events and their own personal logs
        $query->where(function ($q) use ($user) {
            $q->whereNull('actor_id')
                ->orWhere('actor_id', $user->id)
                ->orWhereIn('entity_type', [
                    'Domain',
                    'Department',
                    'Integration',
                    'Incident',
                    'FacebookAds',
                    'GoogleAds',
                    'Workspace',
                ]);
        });
    }

    private static function applyFilters(Builder $query, Request $request): void
    {
        // Event types that have custom labels and should be excluded from generic action filters
        $eventsWithCustomLabels = [
            'incident.resolved',
            'team.invite_resent',
            'team.invite_canceled',
            'department.user_added',
            'department.user_removed',
        ];

        $query
            ->when(
                $request->filled('action'),
                function ($q) use ($request, $eventsWithCustomLabels) {
                    // When filtering by action, exclude events with custom labels
                    $q->where('action', $request->input('action'))
                        ->whereNotIn('event_type', $eventsWithCustomLabels);
                }
            )
            ->when(
                $request->filled('event_type'),
                fn($q) => $q->where('event_type', $request->input('event_type'))
            )
            ->when(
                $request->filled('entity_type'),
                fn($q) => $q->where('entity_type', $request->input('entity_type'))
            )
            ->when(
                $request->filled('actor_id'),
                fn($q) => $q->where('actor_id', (int) $request->input('actor_id'))
            );
    }

    private static function applyDateFilters(Builder $query, Request $request): void
    {
        if ($request->filled('from')) {
            if ($from = self::parseDate($request->input('from'), false)) {
                $query->where('occurred_at', '>=', $from);
            }
        }

        if ($request->filled('to')) {
            if ($to = self::parseDate($request->input('to'), true)) {
                $query->where('occurred_at', '<=', $to);
            }
        }
    }

    private static function applySearchFilter(Builder $query, Request $request): void
    {
        if (! $request->filled('search')) {
            return;
        }

        $term = '%' . strtolower($request->string('search')) . '%';

        $query->where(function ($inner) use ($term) {
            $inner->whereRaw('LOWER(actor_name) LIKE ?', [$term])
                ->orWhereRaw('LOWER(actor_email) LIKE ?', [$term])
                ->orWhereRaw('LOWER(entity_name) LIKE ?', [$term])
                ->orWhereRaw('LOWER(entity_type) LIKE ?', [$term])
                ->orWhereRaw('LOWER(description) LIKE ?', [$term])
                ->orWhereRaw('LOWER(event_type) LIKE ?', [$term])
                ->orWhereRaw('LOWER(action) LIKE ?', [$term])
                ->orWhereRaw('LOWER(actor_ip) LIKE ?', [$term]);
        });
    }

    private static function parseDate(?string $value, bool $endOfDay = false): ?string
    {
        try {
            if (! $value) {
                return null;
            }
            $carbon = Carbon::parse($value);
            return ($endOfDay ? $carbon->endOfDay() : $carbon->startOfDay())->toDateTimeString();
        } catch (\Throwable) {
            return null;
        }
    }
}
