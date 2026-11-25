<?php

namespace App\Http\Controllers;

use App\Models\Domain;
use App\Models\User;
use App\Services\SslEnrichmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Throwable;

class SslMonitoringController extends Controller
{
    private SslEnrichmentService $sslEnrichmentService;

    public function __construct(SslEnrichmentService $sslEnrichmentService)
    {
        try {
            $this->sslEnrichmentService = $sslEnrichmentService;
        } catch (Throwable $e) {
            Log::error('SslMonitoringController constructor failed', ['error' => $e->getMessage()]);
            $this->sslEnrichmentService = $sslEnrichmentService;
        }
    }
    private function authUser(Request $request): User
    {
        try {
            $user = $request->user();
            if (! $user instanceof User) {
                abort(401, 'Unauthenticated.');
            }
            return $user;
        } catch (Throwable $e) {
            Log::error('SSL monitoring authUser failed', ['error' => $e->getMessage()]);
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
            Log::error('SSL monitoring workspaceId failed', ['error' => $e->getMessage()]);
            abort(422, 'Authenticated user does not belong to a workspace.');
        }
    }

    /**
     * Get all domains with SSL information for the workspace
     */
    public function index(Request $request): JsonResponse
    {
        try {
            $user = $this->authUser($request);
            $workspaceId = $this->workspaceId($user);

            $domains = Domain::where('workspace_id', $workspaceId)
                ->where('is_active', true)
                ->select([
                    'id',
                    'ulid',
                    'name',
                    'url',
                    'environment',
                    'status',
                    'ssl_issuer',
                    'ssl_valid_from',
                    'ssl_valid_to',
                    'ssl_days_remaining',
                    'ssl_last_checked_at',
                ])
                ->orderBy('ssl_days_remaining', 'asc')
                ->get()
                ->map(function (Domain $domain) {
                    return [
                        'id' => $domain->id,
                        'ulid' => $domain->ulid,
                        'name' => $domain->name,
                        'url' => $domain->url,
                        'environment' => $domain->environment,
                        'status' => $domain->status,
                        'ssl_issuer' => $domain->ssl_issuer,
                        'ssl_valid_from' => $domain->ssl_valid_from?->toIso8601String(),
                        'ssl_valid_to' => $domain->ssl_valid_to?->toIso8601String(),
                        'ssl_days_remaining' => $domain->ssl_days_remaining,
                        'ssl_last_checked_at' => $domain->ssl_last_checked_at?->toIso8601String(),
                    ];
                });

            return response()->json(['data' => $domains]);
        } catch (Throwable $e) {
            Log::error('SSL monitoring index failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Failed to load SSL monitoring data'], 500);
        }
    }

    /**
     * Get detailed SSL information for a specific domain
     */
    public function show(Request $request, string $domainUlid): JsonResponse
    {
        try {
            $user = $this->authUser($request);
            $workspaceId = $this->workspaceId($user);

            $domain = Domain::where('workspace_id', $workspaceId)
                ->where('ulid', $domainUlid)
                ->first();

            if (! $domain) {
                return response()->json(['message' => 'Domain not found'], 404);
            }

            // Enrich SSL data in real-time
            $enrichedData = $this->sslEnrichmentService->enrichSslData($domain->url);

            $sslInfo = [
                'domain' => [
                    'id' => $domain->id,
                    'ulid' => $domain->ulid,
                    'name' => $domain->name,
                    'url' => $domain->url,
                    'environment' => $domain->environment,
                    'status' => $domain->status,
                ],
                'ssl' => [
                    'issuer' => $domain->ssl_issuer,
                    'subject' => $enrichedData['subject'] ?? 'Unknown',
                    'sans' => $enrichedData['sans'] ?? [],
                    'valid_from' => $domain->ssl_valid_from?->toIso8601String(),
                    'valid_to' => $domain->ssl_valid_to?->toIso8601String(),
                    'days_remaining' => $domain->ssl_days_remaining,
                    'serial_number' => $enrichedData['serial_number'] ?? 'Unknown',
                    'signature_algorithm' => $enrichedData['signature_algorithm'] ?? 'Unknown',
                    'certificate_type' => $enrichedData['certificate_type'] ?? 'Unknown',
                    'platform' => $enrichedData['platform'] ?? 'Unknown',
                    'hosting_provider' => $enrichedData['hosting_provider'] ?? 'Unknown',
                    'last_checked_at' => $domain->ssl_last_checked_at?->toIso8601String(),
                    'is_expired' => $domain->ssl_days_remaining !== null && $domain->ssl_days_remaining < 0,
                    'expires_soon' => $domain->ssl_days_remaining !== null && $domain->ssl_days_remaining <= 30 && $domain->ssl_days_remaining >= 0,
                    'is_valid' => $domain->ssl_days_remaining !== null && $domain->ssl_days_remaining > 0,
                ],
            ];

            return response()->json(['data' => $sslInfo]);
        } catch (Throwable $e) {
            Log::error('SSL monitoring show failed', [
                'domain_ulid' => $domainUlid,
                'error' => $e->getMessage()
            ]);
            return response()->json(['message' => 'Failed to load SSL details'], 500);
        }
    }
}
