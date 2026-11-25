<?php

namespace App\Http\Controllers;

use App\Models\Incident;
use App\Models\IncidentAIChat;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

class AITrainingController extends Controller
{
    /**
     * Generate training dataset for Boomerr Agent
     */
    public function generateTrainingData(Request $request)
    {
        try {
            $validated = $request->validate([
                'limit' => 'nullable|integer|min:1|max:500'
            ]);

            $limit = $validated['limit'] ?? 100;

            // Get incidents with AI chat history
            $incidents = Incident::with(['domain'])
                ->whereNotNull('ai_summary')
                ->where('status', 'resolved')
                ->orderByDesc('started_at')
                ->limit($limit)
                ->get();

            $trainingExamples = [];

            foreach ($incidents as $incident) {
                // Get chat messages if available
                $chatMessages = [];
                if (Schema::hasTable('incident_ai_chat')) {
                    $chatMessages = \App\Models\IncidentAIChat::where('incident_id', $incident->id)
                        ->orderBy('id')
                        ->get(['role', 'message'])
                        ->toArray();
                }

                $example = [
                    'incident_id' => $incident->ulid,
                    'domain' => $incident->domain->name ?? 'N/A',
                    'url' => $incident->domain->url ?? 'N/A',
                    'http_status' => $incident->http_status,
                    'exception' => $incident->exception,
                    'response_headers' => $this->filterHeaders($incident),
                    'duration_ms' => $incident->duration_ms,
                    'ai_analysis' => $incident->ai_summary,
                    'chat_history' => $chatMessages,
                    'resolved_at' => $incident->resolved_at?->toDateTimeString(),
                ];

                $trainingExamples[] = $example;
            }

            return response()->json([
                'total' => count($trainingExamples),
                'training_data' => $trainingExamples,
                'metadata' => [
                    'generated_at' => now()->toDateTimeString(),
                    'system_prompt' => env('BOOMERR_AI_SYSTEM_PROMPT'),
                    'header_filter' => env('BOOMERR_AI_HEADER_FILTER'),
                    'model' => env('DEEPSEEK_MODEL', 'deepseek-chat'),
                ],
            ]);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('Generate training data failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to generate training data'], 500);
        }
    }

    /**
     * Generate a text prompt for fine-tuning Boomerr Agent
     */
    public function generatePromptText(Request $request)
    {
        try {
            $validated = $request->validate([
                'limit' => 'nullable|integer|min:1|max:200'
            ]);

            $limit = $validated['limit'] ?? 50;

            $incidents = Incident::with(['domain'])
                ->whereNotNull('ai_summary')
                ->where('status', 'resolved')
                ->orderByDesc('started_at')
                ->limit($limit)
                ->get();

            $promptText = "# Boomerr Agent Training Prompt\n\n";
            $promptText .= "## System Instructions\n\n";
            $promptText .= env('BOOMERR_AI_SYSTEM_PROMPT', 'You are Boomerr Agent.') . "\n\n";
            $promptText .= "## Example Incidents and Diagnoses\n\n";

            foreach ($incidents as $index => $incident) {
                $num = $index + 1;
                $headers = $this->filterHeaders($incident);
                $headersText = !empty($headers) ? json_encode($headers, JSON_PRETTY_PRINT) : 'None';

                $promptText .= "### Example {$num}\n\n";
                $promptText .= "**Domain:** {$incident->domain->name}\n";
                $promptText .= "**URL:** {$incident->domain->url}\n";
                $promptText .= "**HTTP Status:** {$incident->http_status}\n";
                $promptText .= "**Exception:** " . ($incident->exception ?: 'None') . "\n";
                $promptText .= "**Key Headers:**\n```json\n{$headersText}\n```\n\n";
                $promptText .= "**AI Analysis:**\n{$incident->ai_summary}\n\n";
                $promptText .= "---\n\n";
            }

            return response($promptText, 200)
                ->header('Content-Type', 'text/plain')
                ->header('Content-Disposition', 'attachment; filename="boomerr-ai-training-' . now()->format('Y-m-d') . '.txt"');
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('Generate prompt text failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to generate prompt text'], 500);
        }
    }

    protected function filterHeaders(Incident $incident): array
    {
        $allowedKeys = explode(',', env('BOOMERR_AI_HEADER_FILTER', 'server,content-type,cf-ray,x-powered-by'));
        $allowedKeys = array_map('trim', array_map('strtolower', $allowedKeys));

        $extraHeaders = $incident->extra_headers ?? [];
        $responseHeaders = $extraHeaders['response_headers'] ?? [];

        $filtered = [];
        foreach ($responseHeaders as $key => $value) {
            $normalizedKey = strtolower(trim($key));
            if (in_array($normalizedKey, $allowedKeys, true)) {
                $filtered[$key] = $value;
            }
        }

        return $filtered;
    }
}
