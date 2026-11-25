<?php

namespace App\Services;

use App\Models\User;
use App\Models\UserIntegration;
use App\Models\Workspace;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ClickUpService
{
    private string $clientId;
    private string $clientSecret;
    private string $apiUrl = 'https://api.clickup.com/api/v2';

    public function __construct()
    {
        $this->clientId = (string) config('services.clickup.client_id', env('CLICKUP_CLIENT_ID', ''));
        $this->clientSecret = (string) config('services.clickup.client_secret', env('CLICKUP_CLIENT_SECRET', ''));
    }

    public function exchangeCodeForTokens(string $code): array
    {
        $response = Http::post("{$this->apiUrl}/oauth/token", [
            'client_id' => $this->clientId,
            'client_secret' => $this->clientSecret,
            'code' => $code,
        ]);

        if (!$response->successful()) {
            Log::error('ClickUp token exchange failed', ['response' => $response->body()]);
            throw new \Exception('Failed to exchange code for token.');
        }

        return $response->json();
    }

    public function getUserInfo(string $accessToken): array
    {
        $response = Http::withToken($accessToken)->get("{$this->apiUrl}/user");

        if (!$response->successful()) {
            Log::error('ClickUp user info failed', ['response' => $response->body()]);
            return [];
        }

        return $response->json()['user'] ?? [];
    }

    public function storeIntegration(User $user, array $tokenData, array $userInfo): UserIntegration
    {
        $workspaceId = $user->workspace_id ?? $user->current_workspace_id;
        
        $integration = UserIntegration::updateOrCreate(
            [
                'user_id' => $user->id,
                'provider' => 'clickup',
                'workspace_id' => $workspaceId,
            ],
            [
                'account_id' => $userInfo['id'] ?? null,
                'access_token' => $tokenData['access_token'] ?? null,
                'meta_json' => [
                    'user' => $userInfo,
                ],
                'status' => 'active',
                'connected_at' => now(),
            ]
        );

        return $integration;
    }

    public function getWorkspaces(string $accessToken): array
    {
        $response = Http::withToken($accessToken)->get("{$this->apiUrl}/team");
        if (!$response->successful()) {
            throw new \Exception('Failed to fetch ClickUp workspaces: ' . $response->body());
        }
        return $response->json()['teams'] ?? [];
    }

    public function getSpaces(string $accessToken, string $teamId): array
    {
        $response = Http::withToken($accessToken)->get("{$this->apiUrl}/team/{$teamId}/space");
        if (!$response->successful()) {
            throw new \Exception('Failed to fetch ClickUp spaces: ' . $response->body());
        }
        return $response->json()['spaces'] ?? [];
    }

    public function getFolders(string $accessToken, string $spaceId): array
    {
        $response = Http::withToken($accessToken)->get("{$this->apiUrl}/space/{$spaceId}/folder");
        if (!$response->successful()) {
            throw new \Exception('Failed to fetch ClickUp folders: ' . $response->body());
        }
        return $response->json()['folders'] ?? [];
    }

    public function getListsInSpace(string $accessToken, string $spaceId): array
    {
        $response = Http::withToken($accessToken)->get("{$this->apiUrl}/space/{$spaceId}/list");
        if (!$response->successful()) {
            throw new \Exception('Failed to fetch ClickUp folderless lists: ' . $response->body());
        }
        return $response->json()['lists'] ?? [];
    }

    public function getListsInFolder(string $accessToken, string $folderId): array
    {
        $response = Http::withToken($accessToken)->get("{$this->apiUrl}/folder/{$folderId}/list");
        if (!$response->successful()) {
            throw new \Exception('Failed to fetch ClickUp lists in folder: ' . $response->body());
        }
        return $response->json()['lists'] ?? [];
    }

    public function getMembers(string $accessToken, string $listId): array
    {
        $response = Http::withToken($accessToken)->get("{$this->apiUrl}/list/{$listId}/member");
        if (!$response->successful()) {
            // ClickUp API sometimes requires fetching members from task or workspace level depending on plan.
            // Returning empty array if fails so UI doesn't break.
            return [];
        }
        return $response->json()['members'] ?? [];
    }

    public function getList(string $accessToken, string $listId): array
    {
        $response = Http::withToken($accessToken)->get("{$this->apiUrl}/list/{$listId}");
        if (!$response->successful()) {
            Log::error('ClickUp get list failed', ['response' => $response->body()]);
            return [];
        }
        return $response->json();
    }

    public function getTask(string $accessToken, string $taskId): array
    {
        $response = Http::withToken($accessToken)->get("{$this->apiUrl}/task/{$taskId}");
        if (!$response->successful()) {
            Log::error('ClickUp get task failed', ['response' => $response->body()]);
            return [];
        }
        return $response->json();
    }

    public function createTask(string $accessToken, string $listId, array $data): array
    {
        $response = Http::withToken($accessToken)
            ->post("{$this->apiUrl}/list/{$listId}/task", $data);

        if (!$response->successful()) {
            Log::error('ClickUp task creation failed', ['response' => $response->body()]);
            throw new \Exception('Failed to create ClickUp task: ' . $response->body());
        }

        return $response->json();
    }

    public function updateTask(string $accessToken, string $taskId, array $data): array
    {
        $response = Http::withToken($accessToken)
            ->put("{$this->apiUrl}/task/{$taskId}", $data);

        if (!$response->successful()) {
            Log::error('ClickUp task update failed', ['response' => $response->body()]);
            throw new \Exception('Failed to update ClickUp task: ' . $response->body());
        }

        return $response->json();
    }

    public function addComment(string $accessToken, string $taskId, string $commentText): array
    {
        $response = Http::withToken($accessToken)
            ->post("{$this->apiUrl}/task/{$taskId}/comment", [
                'comment_text' => $commentText,
            ]);

        if (!$response->successful()) {
            Log::error('ClickUp comment creation failed', ['response' => $response->body()]);
            throw new \Exception('Failed to add ClickUp comment: ' . $response->body());
        }

        return $response->json();
    }

    public function uploadAttachment(string $accessToken, string $taskId, string $filePath, string $filename = null): array
    {
        if (!file_exists($filePath)) {
            throw new \Exception("File does not exist: {$filePath}");
        }

        $filename = $filename ?? basename($filePath);
        $fileContents = file_get_contents($filePath);

        $response = Http::withToken($accessToken)
            ->attach('attachment', $fileContents, $filename)
            ->post("{$this->apiUrl}/task/{$taskId}/attachment");

        if (!$response->successful()) {
            Log::error('ClickUp attachment upload failed', ['response' => $response->body()]);
            throw new \Exception('Failed to upload ClickUp attachment: ' . $response->body());
        }

        return $response->json();
    }
}
