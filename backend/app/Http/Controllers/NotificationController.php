<?php

namespace App\Http\Controllers;

use App\Services\PlivoService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class NotificationController extends Controller
{
    public function index(Request $request)
    {
        try {
            $user = $request->user();
            $validated = $request->validate([
                'per_page'     => 'nullable|integer|min:1|max:100',
                'page'         => 'nullable|integer|min:1',
                'workspace_id' => 'nullable|integer',
            ]);
            $workspaceId = $this->resolveWorkspaceId($request);
            $perPage = (int) ($validated['per_page'] ?? 20);
            $page    = (int) ($validated['page'] ?? 1);

            $paginator = $user->notifications()
                ->when($workspaceId, fn($query) => $query->where('workspace_id', $workspaceId))
                ->latest()
                ->paginate($perPage, ['*'], 'page', $page);

            $items = collect($paginator->items())->map(function ($n) {
                $payload = $n->data ?? [];
                $payloadWorkspaceId = $payload['workspace_id']
                    ?? ($payload['domain']['workspace_id'] ?? null);
                return [
                    'id' => $n->id,
                    'type' => $n->type,
                    'action' => $payload['action'] ?? null,
                    'domain' => $payload['domain'] ?? null,
                    'changes' => $payload['changes'] ?? [],
                    'actor' => $payload['actor'] ?? null,
                    'last_response_time_ms' => $payload['last_response_time_ms'] ?? null,
                    'timestamp' => $payload['timestamp'] ?? null,
                    'data' => $payload ?: (object) [],
                    'workspace_id' => $n->workspace_id ?? $payloadWorkspaceId,
                    'read_at' => $n->read_at,
                    'created_at' => $n->created_at,
                ];
            })->values();

            return response()->json([
                'data' => $items,
                'meta' => [
                    'current_page' => $paginator->currentPage(),
                    'per_page' => $paginator->perPage(),
                    'last_page' => $paginator->lastPage(),
                    'total' => $paginator->total(),
                ],
                'unread_count' => $user->unreadNotifications()
                    ->when($workspaceId, fn($query) => $query->where('workspace_id', $workspaceId))
                    ->count(),
            ]);
        } catch (\Throwable $e) {
            Log::error('NotificationController index failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to load notifications'], 500);
        }
    }

    public function markRead(Request $request, string $id)
    {
        try {
            $notification = $request->user()
                ->notifications()
                ->where('id', $id)
                ->firstOrFail();

            $notification->markAsRead();

            return response()->json(['message' => 'ok']);
        } catch (\Throwable $e) {
            Log::error('NotificationController markRead failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to mark notification as read'], 500);
        }
    }

    public function markAllRead(Request $request)
    {
        try {
            $user = $request->user();
            $workspaceId = $this->resolveWorkspaceId($request);

            $user->unreadNotifications()
                ->when($workspaceId, fn($query) => $query->where('workspace_id', $workspaceId))
                ->get()
                ->each(function ($notification) {
                    $notification->markAsRead();
                });

            return response()->json(['message' => 'ok']);
        } catch (\Throwable $e) {
            Log::error('NotificationController markAllRead failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to mark all notifications as read'], 500);
        }
    }

    private function resolveWorkspaceId(Request $request): ?int
    {
        try {
            $validated = $request->validate([
                'workspace_id' => 'nullable|integer',
            ]);
            $explicit = $validated['workspace_id'] ?? null;
            if ($explicit) {
                abort_unless($request->user()->belongsToWorkspace((int) $explicit), 403);
                return (int) $explicit;
            }

            return $request->user()->currentWorkspaceId();
        } catch (\Throwable $e) {
            Log::error('NotificationController resolveWorkspaceId failed: ' . $e->getMessage());
            return null;
        }
    }

    public function callSslExpiryUser(PlivoService $plivo)
    {
        try {
            $mobile = '9876543210';

            $success = $plivo->initiateCall($mobile);

            return response()->json([
                'success' => $success,
            ]);
        } catch (\Throwable $e) {
            Log::error('NotificationController callSslExpiryUser failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to initiate call'], 500);
        }
    }
}
