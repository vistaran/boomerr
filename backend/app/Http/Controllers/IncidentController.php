<?php

namespace App\Http\Controllers;

use App\Http\Resources\SystemLogResource;
use App\Models\Incident;
use App\Models\IncidentAIChat;
use App\Services\AI\IncidentAIService;
use App\Services\AuditLogService;
use App\Services\PlanLimitService;
use Illuminate\Support\Facades\Schema;
use App\Models\User;
use App\Queries\SystemLogQuery;
use App\Services\IncidentRecorderService;
use App\Services\S3Service;
use Aws\S3\S3Client;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Spatie\Browsershot\Browsershot;

class IncidentController extends Controller
{
    public function __construct(
        private readonly S3Service $s3Service
    ) {}

    // List all incidents (with optional filters)
    public function index(Request $request)
    {
        try {
            $user = $request->user();
            if (! $user instanceof User) {
                return response()->json([
                    'message' => 'Unauthenticated.',
                ], 401);
            }
            $workspace = $user->currentWorkspace();
            if (! $workspace || ! PlanLimitService::hasFeature($workspace, 'incident_reporting')) {
                return response()->json([
                    'message' => 'Incident reporting is not available on your current plan. Please upgrade to Solopreneur or above.',
                ]);
            }
            $workspaceId = (int) ($user->currentWorkspaceId() ?? 0);

            $validated = $request->validate([
                'domain_id' => 'nullable|integer',
            ]);

            $query = Incident::query();
            if (!empty($validated['domain_id'])) {
                $query->where('domain_id', $validated['domain_id']);
            }
            $incidents = $query->where('workspace_id', $workspaceId)->with('domain')->orderByDesc('started_at')->paginate(10);
            return response()->json($incidents);
        } catch (\Throwable $e) {
            Log::error('IncidentController index failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to load incidents'], 500);
        }
    }

    // Show details for a single incident
    public function show(Request $request, $id)
    {
        try {
            $user = $request->user();
            if ($user instanceof User) {
                $workspace = $user->currentWorkspace();
                if (! $workspace || ! PlanLimitService::hasFeature($workspace, 'incident_reporting')) {
                    return response()->json([
                        'message' => 'Incident reporting is not available on your current plan. Please upgrade to Solopreneur or above.',
                    ], 403);
                }
            }

            $incident = Incident::where('ulid', $id)
                ->with('domain')
                ->firstOrFail();

            // Full system action logs (same as SystemLogController@index)
            $systemLogs = SystemLogQuery::base(
                $request->user(),
                $request,
                $incident->id
            )->get();

            // AI logic (unchanged)
            if (! $incident->ai_summary && $incident->status === 'ongoing') {
                $ai = app(IncidentAIService::class);
                $timezone = $request->input('timezone', 'UTC');
                $analysis = $ai->analyzeIncident($incident, $timezone);

                $incident->update([
                    'ai_summary' => $analysis,
                    'ai_summary_generated_at' => now(),
                ]);

                if (Schema::hasTable('incident_ai_chat')) {
                    IncidentAIChat::create([
                        'incident_id' => $incident->id,
                        'role' => 'ai',
                        'message' => $analysis,
                    ]);
                }
            }

            return response()->json([
                'incident' => $incident,
                'system_logs' => SystemLogResource::collection($systemLogs),
            ]);
        } catch (\Throwable $e) {
            Log::error('IncidentController show failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to load incident'], 500);
        }
    }

    // Mark an incident as resolved
    public function resolve(Request $request, $id)
    {
        try {
            $user = $request->user();
            if (! $user instanceof User) {
                return response()->json(['message' => 'Unauthenticated.'], 401);
            }

            $workspace = $user->currentWorkspace();
            if (! $workspace || ! PlanLimitService::hasFeature($workspace, 'incident_reporting')) {
                return response()->json([
                    'message' => 'Incident reporting is not available on your current plan. Please upgrade to Solopreneur or above.',
                ], 403);
            }

            // Only allow if user is admin or owner
            if (!in_array($user->role, ['admin', 'owner'])) {
                return response()->json(['message' => 'Forbidden. Only admin or owner can resolve incidents.'], 403);
            }

            $incident = Incident::where('ulid', $id)->with('domain')->firstOrFail();
            $incident->status = 'resolved';
            $incident->resolved_at = now();
            $incident->save();

            app(AuditLogService::class)->incidentResolved($user, $incident);

            if ($incident->domain) {
                $channels = \App\Models\NotificationChannel::where('workspace_id', $incident->domain->workspace_id)
                    ->with('domainIntegration.integration')
                    ->where('domain_id', $incident->domain->id)
                    ->get();

                foreach ($channels as $channel) {
                    $integrationKey = strtolower($channel->type ?? $channel->domainIntegration?->integration?->key ?? '');
                    if ($integrationKey === 'clickup') {
                        $events = $channel->events ?? [];
                        if (in_array('Domain Recovered', $events) || in_array('SSL Recovered', $events) || empty($events)) {
                            \App\Jobs\UpdateClickUpTaskJob::dispatch($incident->id, $channel->id);
                        }
                    }
                }
            }

            return response()->json(['success' => true, 'incident' => $incident]);
        } catch (\Throwable $e) {
            Log::error('IncidentController resolve failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to resolve incident'], 500);
        }
    }

    // (Optional) Proxy chat messages to Boomerr Agent for further conversation
    public function chat(Request $request, $id)
    {
        try {
            $validated = $request->validate([
                'message' => 'nullable|string|max:1000',
                'no_history' => 'nullable|boolean',
                'timezone' => 'nullable|string',
            ]);

            $incident = Incident::where('ulid', $id)->firstOrFail();
            $message = trim((string) ($validated['message'] ?? ''));
            $noHistory = filter_var($validated['no_history'] ?? false, FILTER_VALIDATE_BOOLEAN);
            $timezone = (string) ($validated['timezone'] ?? 'UTC');

            // Build history for context (if table exists)
            $history = [];
            if (Schema::hasTable('incident_ai_chat')) {
                $history = IncidentAIChat::where('incident_id', $incident->id)
                    ->orderBy('id')
                    ->get(['role', 'message'])
                    ->map(fn($m) => ['role' => $m->role, 'content' => $m->message])
                    ->toArray();
            }

            if ($message !== '') {
                $history[] = ['role' => 'user', 'content' => $message];
                if (Schema::hasTable('incident_ai_chat')) {
                    IncidentAIChat::create([
                        'incident_id' => $incident->id,
                        'role' => 'user',
                        'message' => $message,
                    ]);
                }
            }

            // If no history, seed with initial prompt
            if (count($history) === 0) {
                $seed = (new IncidentAIService())->analyzeIncident($incident, $timezone);
                if (Schema::hasTable('incident_ai_chat')) {
                    IncidentAIChat::create([
                        'incident_id' => $incident->id,
                        'role' => 'ai',
                        'message' => $seed,
                    ]);
                }
                return response()->json(['reply' => $seed]);
            }

            // Ask AI (with incident-scoped context and optional history disabling)
            $ai = new IncidentAIService();
            $reply = $ai->chat($incident, $history, $noHistory, $timezone);
            if (Schema::hasTable('incident_ai_chat')) {
                IncidentAIChat::create([
                    'incident_id' => $incident->id,
                    'role' => 'ai',
                    'message' => $reply,
                ]);
            }

            return response()->json(['reply' => $reply]);
        } catch (\Throwable $e) {
            Log::error('IncidentController chat failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to process chat'], 500);
        }
    }

    /**
     * Stream chat response in SSE-like chunks for progressive rendering on the client.
     */
    public function chatStream(Request $request, $id)
    {
        try {
            $validated = $request->validate([
                'message' => 'nullable|string|max:1000',
                'no_history' => 'nullable|boolean',
                'timezone' => 'nullable|string',
            ]);

            $incident = Incident::where('ulid', $id)->firstOrFail();
            $message = trim((string) ($validated['message'] ?? ''));
            $noHistory = filter_var($validated['no_history'] ?? false, FILTER_VALIDATE_BOOLEAN);
            $timezone = (string) ($validated['timezone'] ?? 'UTC');

            // Build history for context (if table exists)
            $history = [];
            if (Schema::hasTable('incident_ai_chat')) {
                $history = IncidentAIChat::where('incident_id', $incident->id)
                    ->orderBy('id')
                    ->get(['role', 'message'])
                    ->map(fn($m) => ['role' => $m->role, 'content' => $m->message])
                    ->toArray();
            }

            if ($message !== '') {
                $history[] = ['role' => 'user', 'content' => $message];
                if (Schema::hasTable('incident_ai_chat')) {
                    IncidentAIChat::create([
                        'incident_id' => $incident->id,
                        'role' => 'user',
                        'message' => $message,
                    ]);
                }
            }

            // If no history, seed with initial prompt
            if (count($history) === 0) {
                $seed = (new IncidentAIService())->analyzeIncident($incident, $timezone);
                if (Schema::hasTable('incident_ai_chat')) {
                    IncidentAIChat::create([
                        'incident_id' => $incident->id,
                        'role' => 'ai',
                        'message' => $seed,
                    ]);
                }
                return new StreamedResponse(function () use ($seed) {
                    @set_time_limit(0);
                    @ignore_user_abort(true);
                    // Try to disable output buffering/compression in various environments
                    @ini_set('zlib.output_compression', '0');
                    @ini_set('output_buffering', 'off');
                    @ob_implicit_flush(true);
                    if (function_exists('apache_setenv')) {
                        @apache_setenv('no-gzip', '1');
                    }
                    while (ob_get_level() > 0) {
                        @ob_end_flush();
                    }
                    // Kick some proxies/servers to start sending immediately (padding)
                    echo ':' . str_repeat(' ', 2048) . "\n\n";
                    @ob_flush();
                    @flush();

                    echo 'data: ' . json_encode(['delta' => $seed]) . "\n\n";
                    echo "data: [DONE]\n\n";
                    @ob_flush();
                    @flush();
                }, 200, [
                    'Content-Type' => 'text/event-stream; charset=utf-8',
                    'Cache-Control' => 'no-cache, no-transform',
                    'Connection' => 'keep-alive',
                    'X-Accel-Buffering' => 'no',
                ]);
            }

            // Ask AI (non-streaming here), then stream the text in chunks
            $ai = new IncidentAIService();
            $reply = $ai->chat($incident, $history, $noHistory, $timezone);
            if (Schema::hasTable('incident_ai_chat')) {
                IncidentAIChat::create([
                    'incident_id' => $incident->id,
                    'role' => 'ai',
                    'message' => $reply,
                ]);
            }

            $response = new StreamedResponse(function () use ($reply) {
                @set_time_limit(0);
                @ignore_user_abort(true);
                @ini_set('zlib.output_compression', '0');
                @ini_set('output_buffering', 'off');
                @ob_implicit_flush(true);
                if (function_exists('apache_setenv')) {
                    @apache_setenv('no-gzip', '1');
                }
                while (ob_get_level() > 0) {
                    @ob_end_flush();
                }

                // Kick-off for some proxies/servers with padding
                echo ':' . str_repeat(' ', 2048) . "\n\n";
                @ob_flush();
                @flush();

                // Chunk the reply into small pieces to simulate streaming
                $length = strlen($reply);
                $chunkSize = 120; // characters per chunk
                for ($i = 0; $i < $length; $i += $chunkSize) {
                    $delta = substr($reply, $i, $chunkSize);
                    echo 'data: ' . json_encode(['delta' => $delta]) . "\n\n";
                    @ob_flush();
                    @flush();
                    usleep(60 * 1000); // 60ms between chunks
                }
                echo "data: [DONE]\n\n";
                @ob_flush();
                @flush();
            }, 200, [
                'Content-Type' => 'text/event-stream; charset=utf-8',
                'Cache-Control' => 'no-cache, no-transform',
                'Connection' => 'keep-alive',
                'X-Accel-Buffering' => 'no',
            ]);

            return $response;
        } catch (\Throwable $e) {
            Log::error('IncidentController chatStream failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to process chat stream'], 500);
        }
    }

    /**
     * Get chat history for incident
     */
    public function getChat($id)
    {
        try {
            $incident = Incident::where('ulid', $id)->firstOrFail();
            if (!Schema::hasTable('incident_ai_chat')) {
                return response()->json(['messages' => []]);
            }

            $messages = IncidentAIChat::where('incident_id', $incident->id)
                ->orderBy('id')
                ->get(['role', 'message', 'created_at']);
            return response()->json(['messages' => $messages]);
        } catch (\Throwable $e) {
            Log::error('IncidentController getChat failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to load chat history'], 500);
        }
    }

    /**
     * Return a signed screenshot URL for the incident (or fallback to public URL).
     */
    public function screenshotUrl($incident)
    {

        try {

            $incident = Incident::where('ulid', $incident)->firstOrFail();

            $signedUrl = $this->s3Service->getSignedUrl($incident->screenshot_url);

            if ($signedUrl) {
                return response()->json(['url' => $signedUrl]);
            }

            return null;
        } catch (\Exception $e) {
            Log::error('Error generating signed URL: ' . $e->getMessage());
            return null; // Return null if there's an error
        }
    }

    /**
     * Analyze the incident error response using Boomerr Agent, store and return the result.
     */
    public function analyze(Request $request, $id)
    {
        try {
            $incident = Incident::where('ulid', $id)->firstOrFail();
            if ($incident->ai_analysis) {
                return response()->json(['ai_analysis' => $incident->ai_analysis]);
            }

            // Compose a prompt for the AI based on incident data
            $prompt = $this->buildIncidentPrompt($incident);

            // TODO: Replace this with a real call to Boomerr Agent API
            $aiAnalysis = $this->callBoomerrAIAgent($prompt);

            $incident->ai_analysis = $aiAnalysis;
            $incident->save();

            return response()->json(['ai_analysis' => $aiAnalysis]);
        } catch (\Throwable $e) {
            Log::error('IncidentController analyze failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to analyze incident'], 500);
        }
    }

    /**
     * Build a prompt for the AI agent based on incident data.
     */
    protected function buildIncidentPrompt($incident)
    {
        try {
            $domain = $incident->domain;
            $status = $incident->http_status ?? 'unknown';
            $body = $incident->response_body ?? '';
            $exception = $incident->exception ?? '';
            return "Analyze the following incident for the domain '{$domain->name}' (URL: {$domain->url}):\n\n" .
                "HTTP Status: {$status}\n" .
                ($exception ? "Exception: {$exception}\n" : '') .
                ($body ? "Response Body: {$body}\n" : '') .
                "\nGive a concise summary of the likely root cause and possible fixes.";
        } catch (\Throwable $e) {
            Log::error('buildIncidentPrompt failed: ' . $e->getMessage());
            return 'Failed to build incident prompt';
        }
    }

    /**
     * Simulate a call to Boomerr Agent API (replace with real integration).
     */
    protected function callBoomerrAIAgent($prompt)
    {
        try {
            // TODO: Replace with real HTTP call to Boomerr Agent API
            // For now, return a placeholder response
            return 'AI analysis placeholder: ' . substr($prompt, 0, 120) . '...';
        } catch (\Throwable $e) {
            Log::error('callBoomerrAIAgent failed: ' . $e->getMessage());
            return 'Failed to call AI agent';
        }
    }
    /**
     * Generate and download a professional PDF report for the incident.
     */
    public function downloadPdf(Request $request, $id)
    {
        try {
            $incident = Incident::where('ulid', $id)
                ->with('domain')
                ->firstOrFail();

            // Check workspace/plan limits
            $user = $request->user();
            if ($user instanceof User) {
                $workspace = $user->currentWorkspace();
                if (!$workspace || !PlanLimitService::hasFeature($workspace, 'incident_reporting')) {
                    return response()->json([
                        'message' => 'Incident reporting is not available on your current plan.',
                    ], 403);
                }
            }

            // Fetch logs
            $systemLogs = SystemLogQuery::base($request->user(), $request, $incident->id)->get();

            // Get base64 logo for PDF
            $logoPath = public_path('images/logo-5.png');
            $logoBase64 = '';
            if (file_exists($logoPath)) {
                $logoBase64 = 'data:image/png;base64,' . base64_encode(file_get_contents($logoPath));
            }

            // Generate signed URL for screenshot if it exists
            if ($incident->screenshot_url) {
                $incident->screenshot_url = $this->s3Service->getSignedUrl($incident->screenshot_url) ?? $incident->screenshot_url;
            }

            // Render the HTML view
            $html = view('reports.incident', [
                'incident' => $incident,
                'systemLogs' => $systemLogs,
                'logo' => $logoBase64,
            ])->render();

            // If we want to use Browsershot to generate the PDF
            try {
                $pdf = Browsershot::html($html)
                    ->setNodeBinary(config('services.browsershot.node_binary'))
                    ->setNpmBinary(config('services.browsershot.npm_binary'))
                    ->noSandbox()
                    ->format('A4')
                    ->showBackground()
                    ->margins(0, 0, 0, 0)
                    ->pdf();

                return response($pdf)
                    ->header('Content-Type', 'application/pdf')
                    ->header('Content-Disposition', 'attachment; filename="Incident_Report_' . $incident->ulid . '.pdf"');
            } catch (\Throwable $e) {
                Log::warning('Browsershot failed, falling back to HTML print view: ' . $e->getMessage());
                return response($html);
            }
        } catch (\Throwable $e) {
            Log::error('IncidentController downloadPdf failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to generate PDF report'], 500);
        }
    }
    /**
     * Generate and download a professional PDF summary report of all incidents.
     */
    public function downloadAllPdf(Request $request)
    {
        try {
            $user = $request->user();
            if (! $user instanceof User) {
                return response()->json(['message' => 'Unauthorized'], 401);
            }

            // Check workspace/plan limits
            $workspace = $user->currentWorkspace();
            if (!$workspace || !PlanLimitService::hasFeature($workspace, 'incident_reporting')) {
                return response()->json([
                    'message' => 'Incident reporting is not available on your current plan.',
                ], 403);
            }

            // Fetch all incidents for the current workspace
            $incidents = Incident::where('workspace_id', $workspace->id)
                ->with('domain')
                ->orderBy('started_at', 'desc')
                ->get();

            // Get base64 logo for PDF
            $logoPath = public_path('images/logo-5.png');
            $logoBase64 = '';
            if (file_exists($logoPath)) {
                $logoBase64 = 'data:image/png;base64,' . base64_encode(file_get_contents($logoPath));
            }

            // Render the HTML view
            $html = view('reports.all-incidents', [
                'incidents' => $incidents,
                'logo' => $logoBase64,
            ])->render();

            // Generate PDF using Browsershot
            try {
                $pdf = Browsershot::html($html)
                    ->setNodeBinary(config('services.browsershot.node_binary'))
                    ->setNpmBinary(config('services.browsershot.npm_binary'))
                    ->noSandbox()
                    ->format('A4')
                    ->showBackground()
                    ->margins(0, 0, 0, 0)
                    ->pdf();

                return response($pdf)
                    ->header('Content-Type', 'application/pdf')
                    ->header('Content-Disposition', 'attachment; filename="Incidents_Summary_Report.pdf"');
            } catch (\Throwable $e) {
                Log::warning('Browsershot failed, falling back to HTML print view: ' . $e->getMessage());
                return response($html);
            }
        } catch (\Exception $e) {
            Log::error('PDF generation error: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to generate PDF'], 500);
        }
    }
    /**
     * Generate and download a CSV report of all incidents.
     */
    public function downloadAllCsv(Request $request)
    {
        try {
            $user = $request->user();
            if (!$user instanceof User) {
                return response()->json(['message' => 'Unauthorized'], 401);
            }

            $workspace = $user->currentWorkspace();
            if (!$workspace) {
                return response()->json(['message' => 'Workspace not found'], 404);
            }

            $headers = [
                'Content-Type' => 'text/csv',
                'Content-Disposition' => 'attachment; filename="Incidents_Summary_Report_' . date('Y-m-d') . '.csv"',
                'Cache-Control' => 'no-cache, no-store, must-revalidate',
                'Pragma' => 'no-cache',
                'Expires' => '0',
            ];

            $callback = function () use ($workspace) {
                $file = fopen('php://output', 'w');

                // CSV Headers
                fputcsv($file, [
                    'Incident ID',
                    'Domain Name',
                    'Status',
                    'Started At',
                    'Resolved At',
                    'Duration',
                    'Root Cause Summary'
                ]);

                // Use cursor for memory efficiency
                $incidents = Incident::where('workspace_id', $workspace->id)
                    ->with('domain')
                    ->orderBy('started_at', 'desc')
                    ->cursor();

                foreach ($incidents as $incident) {
                    // Use a more Excel-friendly date format
                    $startedAt = $incident->started_at ? $incident->started_at->format('d M Y, H:i:s') : 'N/A';
                    $resolvedAt = $incident->resolved_at ? $incident->resolved_at->format('d M Y, H:i:s') : 'Ongoing';

                    $duration = $incident->resolved_at
                        ? $incident->started_at->diffForHumans($incident->resolved_at, true)
                        : 'Ongoing';

                    fputcsv($file, [
                        $incident->ulid,
                        $incident->domain->name ?? 'N/A',
                        $incident->resolved_at ? 'RESOLVED' : 'ONGOING',
                        $startedAt,
                        $resolvedAt,
                        $duration,
                        $incident->root_cause_summary ?? 'No summary available'
                    ]);
                }

                fclose($file);
            };

            return response()->stream($callback, 200, $headers);
        } catch (\Exception $e) {
            Log::error('CSV Download error: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to generate CSV'], 500);
        }
    }
}
