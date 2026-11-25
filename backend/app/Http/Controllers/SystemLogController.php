<?php

namespace App\Http\Controllers;

use App\Enums\SystemLogEventType;
use App\Http\Resources\SystemLogResource;
use App\Models\DomainStatusEvent;
use App\Models\SystemLog;
use App\Models\User;
use App\Queries\SystemLogQuery;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Log;

class SystemLogController extends Controller
{
    /**
     * User-action event types that should be excluded from System Action Logs.
     * These are actions performed by users, not automated system actions.
     */
    public const EXCLUDED_EVENT_TYPES = [
        'domain.created',
        'domain.updated',
        'domain.deleted',
        'webhook.test',
        'integration.channel.created',
        'integration.channel.updated',
        'integration.channel.deleted',
    ];

    /**
     * Integration keys that require role-based filtering.
     * Members can only see their own logs, admins can see members + admins, owners see all.
     */
    private const ROLE_FILTERED_INTEGRATIONS = ['whatsapp', 'email', 'call', 'sms'];

    public function index(Request $request)
    {
        try {
            $user = $request->user();

            $validated = $request->validate([
                'per_page' => 'nullable|integer|min:5|max:100',
                'from' => 'nullable|date',
                'to' => 'nullable|date',
                'search' => 'nullable|string|max:255',
            ]);

            $perPage = (int) ($validated['per_page'] ?? 25);

            return SystemLogResource::collection(
                SystemLogQuery::base($user, $request)->paginate($perPage)
            )->additional([
                'user_role' => $user->roleInWorkspace($user->currentWorkspaceId()),
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'message' => 'Failed to retrieve system logs',
                'error' => $e->getMessage(),
            ], 500);
        }
    }


    /**
     * Apply role-based filtering for personal integrations.
     * - Members: can only see their own logs for WhatsApp, Email, Call, SMS
     * - Admins: can see all members + all admins logs (not owners)
     * - Owners: can see everyone's logs
     */
    public function applyRoleBasedFiltering(Builder $query, User $user, string $userRole, int $workspaceId): void
    {
        try {
            if ($userRole === 'owner') {
                // Owners see everything - no additional filtering needed
                return;
            }

            $query->where(function (Builder $builder) use ($user, $userRole, $workspaceId) {
                // For non-role-filtered integrations (discord, slack webhooks), show all
                $builder->whereHas('integration', function (Builder $integrationQuery) {
                    $integrationQuery->whereNotIn('key', self::ROLE_FILTERED_INTEGRATIONS);
                })
                    // OR for role-filtered integrations, apply visibility rules
                    ->orWhere(function (Builder $roleFiltered) use ($user, $userRole, $workspaceId) {
                        $roleFiltered->whereHas('integration', function (Builder $integrationQuery) {
                            $integrationQuery->whereIn('key', self::ROLE_FILTERED_INTEGRATIONS);
                        });

                        if ($userRole === 'member') {
                            // Members only see their own logs
                            $roleFiltered->where('actor_id', $user->id);
                        } elseif ($userRole === 'admin') {
                            // Admins see members + admins (not owners)
                            $roleFiltered->whereIn('actor_role', ['member', 'admin']);
                        }
                    })
                    // Also include logs without integration (general system logs)
                    ->orWhereNull('integration_id');
            });
        } catch (\Throwable $e) {
            Log::error('Error applying role-based filtering: ' . $e->getMessage());
        }
    }

    private function applyDateFilters(Builder $builder, Request $request): void
    {
        try {
            $validated = $request->validate([
                'from' => 'nullable|date',
                'to' => 'nullable|date',
            ]);

            if (!empty($validated['from'])) {
                $from = $this->parseDate($validated['from']);
                if ($from) {
                    $builder->where('occurred_at', '>=', $from);
                }
            }

            if (!empty($validated['to'])) {
                $to = $this->parseDate($validated['to']);
                if ($to) {
                    $builder->where('occurred_at', '<=', $to);
                }
            }
        } catch (\Throwable $e) {
            Log::error('Error applying date filters: ' . $e->getMessage());
        }
    }

    private function applySearchFilter(Builder $builder, Request $request): void
    {
        try {
            $validated = $request->validate([
                'search' => 'nullable|string|max:255',
            ]);

            if (empty($validated['search'])) {
                return;
            }

            $term = '%' . strtolower($validated['search']) . '%';

            $builder->where(function (Builder $inner) use ($term) {
                $inner->whereRaw('LOWER(message) LIKE ?', [$term])
                    ->orWhereRaw('LOWER(actor_name) LIKE ?', [$term])
                    ->orWhereRaw('LOWER(actor_email) LIKE ?', [$term])
                    ->orWhereRaw('LOWER(event_type) LIKE ?', [$term])
                    ->orWhere('correlation_id', 'like', '%' . trim($term, '%') . '%');
            });
        } catch (\Throwable $e) {
            Log::error('Error applying search filter: ' . $e->getMessage());
        }
    }

    private function parseDate(?string $value): ?string
    {
        if (! $value) {
            return null;
        }

        try {
            return Carbon::parse($value)->toDateTimeString();
        } catch (\Throwable) {
            return null;
        }
    }
}
