<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\UserIntegration;
use App\Services\ClickUpService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

class ClickUpIntegrationController extends Controller
{
    private ClickUpService $clickUpService;

    public function __construct(ClickUpService $clickUpService)
    {
        $this->clickUpService = $clickUpService;
    }

    public function connect(Request $request)
    {
        try {
            $user = Auth::user();
            $clientId = config('services.clickup.client_id');
            $frontend = config('app.frontend_url', env('FRONTEND_URL', '/'));

            if (!$user || !$clientId) {
                if ($request->expectsJson()) {
                    return response()->json(['error' => 'Unauthorized or missing configuration'], 401);
                }
                return redirect(rtrim((string) $frontend, '/') . '/integrations?clickup=error');
            }

            // ClickUp OAuth URL doesn't use standard redirect_uri parameter in the URL.
            // It relies on the redirect URI configured in the ClickUp App settings.
            $oauthUrl = 'https://app.clickup.com/api?' . http_build_query([
                'client_id' => $clientId,
                'redirect_uri' => config('app.url') . '/api/integrations/clickup/callback',
            ]);

            // We can't strictly pass 'state' via standard ClickUp OAuth flow easily if it doesn't support it,
            // but the docs say we can pass state if we want (actually, standard OAuth 2.0 uses it).
            // Let's add state for CSRF.
            $oauthUrl .= '&state=' . $user->id;

            if ($request->expectsJson()) {
                return response()->json(['data' => ['oauthUrl' => $oauthUrl]]);
            }

            return redirect($oauthUrl);
        } catch (\Throwable $e) {
            Log::error('ClickUp connect failed: ' . $e->getMessage());
            $frontend = config('app.frontend_url', env('FRONTEND_URL', '/'));
            return redirect(rtrim((string) $frontend, '/') . '/integrations?error=server_error');
        }
    }

    public function callback(Request $request)
    {
        try {
            $frontend = config('app.frontend_url', env('FRONTEND_URL', '/'));
            $redirectBase = rtrim((string) $frontend, '/') . '/overview';

            $error = $request->string('error')->toString();
            if ($error) {
                Log::error('ClickUp OAuth callback returned error', ['error' => $error]);
                return redirect($redirectBase . '?clickup_status=error&reason=oauth_failed');
            }

            $code = $request->string('code')->toString();
            if (!$code) {
                return redirect($redirectBase . '?clickup_status=error&reason=missing_code');
            }

            // In some configurations ClickUp doesn't reliably return state, but let's check if we passed it.
            $state = $request->string('state')->toString();
            $user = Auth::user();
            if (!$user && $state) {
                $user = User::find((int) $state);
            }

            if (!$user) {
                Log::error('ClickUp OAuth state mismatch or missing user');
                return redirect($redirectBase . '?clickup_status=error&reason=invalid_state');
            }

            $tokenData = $this->clickUpService->exchangeCodeForTokens($code);

            if (!isset($tokenData['access_token'])) {
                Log::error('No access token received from ClickUp', ['user_id' => $user->id]);
                return redirect($redirectBase . '?clickup_status=error&reason=no_token');
            }

            $userInfo = $this->clickUpService->getUserInfo($tokenData['access_token']);

            $this->clickUpService->storeIntegration($user, $tokenData, $userInfo);

            Log::info('ClickUp integration created', ['user_id' => $user->id]);

            return redirect($redirectBase . '?clickup_status=success');

        } catch (\Throwable $e) {
            Log::error('ClickUp callback failed: ' . $e->getMessage());
            $frontend = config('app.frontend_url', env('FRONTEND_URL', '/'));
            return redirect(rtrim((string) $frontend, '/') . '/integrations?clickup_status=error&reason=server_error');
        }
    }

    public function disconnect(Request $request)
    {
        $user = Auth::user();
        $workspaceId = $user->workspace_id ?? $user->current_workspace_id;

        UserIntegration::where('provider', 'clickup')
            ->where('workspace_id', $workspaceId)
            ->delete();

        return response()->json(['message' => 'Disconnected ClickUp successfully']);
    }

    public function status(Request $request)
    {
        $user = Auth::user();
        $workspaceId = $user->workspace_id ?? $user->current_workspace_id;

        $integration = UserIntegration::where('provider', 'clickup')
            ->where('workspace_id', $workspaceId)
            ->first();

        return response()->json([
            'data' => [
                'connected' => (bool) $integration,
                'user' => $integration ? ($integration->meta_json['user'] ?? null) : null,
            ]
        ]);
    }

    public function getHierarchy(Request $request)
    {
        $user = Auth::user();
        $workspaceId = $user->workspace_id ?? $user->current_workspace_id;

        $integration = UserIntegration::where('provider', 'clickup')
            ->where('workspace_id', $workspaceId)
            ->first();

        if (!$integration || !$integration->access_token) {
            return response()->json(['error' => 'ClickUp not connected'], 400);
        }

        $token = $integration->access_token;
        $type = $request->query('type'); // workspaces, spaces, folders, lists

        try {
            switch ($type) {
                case 'workspaces':
                    return response()->json(['data' => $this->clickUpService->getWorkspaces($token)]);

                case 'spaces':
                    $teamId = $request->query('team_id');
                    return response()->json(['data' => $this->clickUpService->getSpaces($token, $teamId)]);

                case 'folders':
                    $spaceId = $request->query('space_id');
                    return response()->json(['data' => $this->clickUpService->getFolders($token, $spaceId)]);

                case 'lists':
                    $spaceId = $request->query('space_id');
                    $folderId = $request->query('folder_id');
                    if ($folderId) {
                        return response()->json(['data' => $this->clickUpService->getListsInFolder($token, $folderId)]);
                    } else if ($spaceId) {
                        return response()->json(['data' => $this->clickUpService->getListsInSpace($token, $spaceId)]);
                    }
                    return response()->json(['error' => 'Missing space_id or folder_id'], 400);

                case 'members':
                    $listId = $request->query('list_id');
                    return response()->json(['data' => $this->clickUpService->getMembers($token, $listId)]);

                default:
                    return response()->json(['error' => 'Invalid hierarchy type'], 400);
            }
        } catch (\Throwable $e) {
            Log::error('ClickUp hierarchy fetch failed: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to fetch data from ClickUp'], 500);
        }
    }
}
