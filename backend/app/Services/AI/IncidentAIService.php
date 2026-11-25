<?php

namespace App\Services\AI;

use App\Models\Incident;
use Illuminate\Support\Facades\Log;

class IncidentAIService
{
    /**
     * Generate initial AI analysis for an incident
     */
    public function analyzeIncident(Incident $incident, string $timezone = 'UTC'): string
    {
        $prompt = $this->buildInitialPrompt($incident, $timezone);
        return $this->callLLM($incident, $prompt, null, false, $timezone);
    }

    /**
     * Continue chat with context for a specific incident.
     * @param Incident $incident The current incident to ensure context isolation
     * @param array<int,array{role:string,content:string}> $messages Chat history/messages
     * @param bool $noHistory If true, do not include past messages, only system + incident context + latest user
     * @param string $timezone The user's local timezone
     */
    public function chat(Incident $incident, array $messages, bool $noHistory = false, string $timezone = 'UTC'): string
    {
        // Build an incident context block that's injected on every call
        $context = $this->buildIncidentContextBlock($incident, $timezone);
        return $this->callLLM($incident, $messages, $context, $noHistory, $timezone);
    }

    protected function buildInitialPrompt(Incident $incident, string $timezone = 'UTC'): string
    {
        $domainName = $incident->domain->name ?? 'N/A';
        $domainUrl = $incident->domain->url ?? 'N/A';
        $httpStatus = $incident->http_status ?? 'N/A';
        $exception = $incident->exception ?: 'N/A';
        $bodySnippet = $incident->response_body ? substr($incident->response_body, 0, 2000) : 'N/A';

        // Filter response headers to only important ones
        $respHeaders = $this->filterResponseHeaders($incident);
        $respHeadersJson = !empty($respHeaders) ? json_encode($respHeaders, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) : 'N/A';

        // Get system prompt from env or use default
        $systemPrompt = env('BOOMERR_AI_SYSTEM_PROMPT', 'You are Boomerr Agent, an expert in diagnosing website and domain outages. Analyze incidents thoroughly and provide actionable remediation steps.');

        $identityGuard = "IMPORTANT: You are Boomerr Agent. Only answer incident-related topics (website, domain, server errors, DNS, SSL/TLS, HTTP, headers). If off-topic, politely redirect to incident diagnosis. Treat each incident as isolated; do NOT use other incidents’ context.";

        $resolvedLine = $incident->resolved_at
            ? 'Incident Resolved Time (User View): ' . $incident->resolved_at
            ->copy()
            ->setTimezone($timezone)
            ->format('M j, Y, H:i:s')
            : '';

        return <<<PROMPT
{$systemPrompt}
{$identityGuard}

Incident Context:
Domain: {$domainName}
URL: {$domainUrl}
HTTP Status: {$httpStatus}
Detection Time (User View): {$incident->started_at->copy()->setTimezone($timezone)->format('M j, Y, H:i:s')}
{$resolvedLine}
Technical Metadata (Internal Only): incident_id_{$incident->started_at->timestamp}
Status: {$incident->status}

Key Response Headers:
{$respHeadersJson}

Exception (if any): {$exception}

Response body (first 2000 chars):
{$bodySnippet}

Task: Analyze likely causes referencing HTTP status and headers, then provide prioritized remediation steps.
PROMPT;
    }

    /**
     * Filter response headers to only include important diagnostic ones
     */
    protected function filterResponseHeaders(Incident $incident): array
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

    /**
     * @param Incident $incident The incident context
     * @param string|array<int,array{role:string,content:string}> $payload
     * @param string|null $incidentContext Optional incident context block to prepend
     * @param bool $noHistory If true, only send latest user message + system + incident context
     * @param string $timezone The user's local timezone
     */
    protected function callLLM(Incident $incident, $payload, ?string $incidentContext = null, bool $noHistory = false, string $timezone = 'UTC'): string
    {
        $apiKey = config('services.ai.key', env('DEEPSEEK_API_KEY', env('AI_API_KEY')));
        if (!$apiKey) {
            return 'AI diagnostics are optional and not configured (missing DEEPSEEK_API_KEY).';
        }

        try {
            $model = config('services.ai.model', env('DEEPSEEK_MODEL', 'deepseek-chat'));

            $localTimeStr = $incident->started_at->copy()->setTimezone($timezone)->format('M j, Y, \a\t H:i:s');
            $fullFormat = "{$localTimeStr}";

            // Normalize messages and roles + enforce identity and scope
            $messages = [];
            $enforcement = "
You are Boomerr Agent.

You are operating inside a specific incident thread in Boomerr.

Always assume user questions refer to THIS incident unless explicitly stated otherwise.

If a user asks:
- 'How can I fix this?'
- 'Why is this happening?'
- 'What should I do?'
- 'Is this critical?'
- 'How do I resolve it?'

They are referring to the current incident context already provided.

Do NOT ask for more context unless the incident data itself is missing.
Stay focused on diagnosing and resolving this specific incident.

Response Rules:
- MANDATORY: When the user asks when the incident happened, you MUST use '{$fullFormat}'. DO NOT report any UTC or technical times. Only report the local time as it appears in the user's dashboard.
- Keep responses concise but complete.
- Maximum 8–12 bullet points.
- Avoid unnecessary explanations.
- Do NOT exceed approximately 600 words.
- Do NOT cut off mid-sentence.
";

            if (is_string($payload)) {
                // Initial analysis path: payload is a prompt string
                // Off-topic quick check: if prompt seems unrelated, short-circuit with redirect
                if ($this->isOffTopic($payload)) {
                    return "Hi! I'm Boomerr Agent, focused on website and domain incident diagnostics (server errors, DNS, SSL/TLS, HTTP, headers, outages). I can greet and chat briefly, but for useful help, ask something about this incident or monitoring context.";
                }
                $messages[] = ['role' => 'system', 'content' => $payload];
                if ($incidentContext) {
                    $messages[] = ['role' => 'system', 'content' => $incidentContext . "\n\n" . $enforcement];
                }
            } else {
                // Chat path: prepend strict guardrails
                $baseSystemPrompt = env('BOOMERR_AI_SYSTEM_PROMPT', 'You are Boomerr Agent, an expert in diagnosing website and domain outages. Analyze incidents thoroughly and provide actionable remediation steps.');
                $messages[] = ['role' => 'system', 'content' => $baseSystemPrompt . "\n\n" . $enforcement];
                if ($incidentContext) {
                    $messages[] = ['role' => 'system', 'content' => $incidentContext . "\n\n" . $enforcement];
                }

                // Map stored chat messages
                $mapped = array_map(function (array $m) {
                    $role = $m['role'] ?? 'user';
                    if ($role === 'ai') {
                        $role = 'assistant';
                    }
                    $content = (string)($m['content'] ?? $m['message'] ?? '');
                    return ['role' => $role, 'content' => $content];
                }, $payload);

                if ($noHistory) {
                    // Keep only the latest user message
                    $latestUser = null;
                    for ($i = count($mapped) - 1; $i >= 0; $i--) {
                        if (($mapped[$i]['role'] ?? '') === 'user') {
                            $latestUser = $mapped[$i];
                            break;
                        }
                    }
                    if ($latestUser) {
                        $messages[] = $latestUser;
                    }
                } else {
                    $messages = array_merge($messages, $mapped);
                }

                // Off-topic quick check: if last user message seems unrelated, short-circuit with redirect
                $lastUser = null;
                for ($i = count($messages) - 1; $i >= 0; $i--) {
                    if (($messages[$i]['role'] ?? '') === 'user') {
                        $lastUser = $messages[$i]['content'] ?? '';
                        break;
                    }
                }
                if ($lastUser && $this->isOffTopic($lastUser)) {
                    return "Hi! I'm Boomerr Agent, focused on website and domain incident diagnostics (server errors, DNS, SSL/TLS, HTTP, headers, outages). I can greet and chat briefly, but for useful help, ask something about this incident or monitoring context.";
                }
            }

            $baseUrl = rtrim(config('services.ai.base_url', env('AI_BASE_URL', 'https://api.deepseek.com/v1')), '/');

            // Build the OpenAI client using the supported helper. Fallback to Laravel facade if needed.
            if (class_exists(\OpenAI::class)) {
                // Provided by openai-php/client via files autoload
                $client = \OpenAI::factory()
                    ->withApiKey($apiKey)
                    ->withBaseUri($baseUrl)
                    ->make();
            } else {
                // Fallback to Laravel facade binding
                /** @var \OpenAI\Client $client */
                $client = \OpenAI\Laravel\Facades\OpenAI::factory()
                    ->withApiKey($apiKey)
                    ->withBaseUri($baseUrl)
                    ->make();
            }

            // Retry on rate limits with exponential backoff
            $attempts = (int) env('DEEPSEEK_RETRY_ATTEMPTS', 3);
            $baseDelay = (int) env('DEEPSEEK_RETRY_BASE_SECONDS', 1); // seconds
            $response = null;
            for ($i = 0; $i < max(1, $attempts); $i++) {
                try {
                    $response = $client->chat()->create([
                        'model' => $model,
                        'temperature' => 0.2,
                        'max_tokens' => 1000,
                        'messages' => $messages,
                    ]);
                    break; // success
                } catch (\OpenAI\Exceptions\RateLimitException $rateEx) {
                    if ($i === $attempts - 1) {
                        // Exhausted retries
                        return 'AI is busy right now. Please try again in a few seconds.';
                    }
                    // Backoff with jitter
                    $delay = $baseDelay * (2 ** $i);
                    $jitter = random_int(0, 300) / 1000; // 0-0.3s
                    usleep((int) (($delay + $jitter) * 1_000_000));
                    continue;
                }
            }

            $choice = $response?->choices[0] ?? null;
            $content = $choice && isset($choice->message->content) ? $choice->message->content : null;
            return $content ?: 'AI did not return a response.';
        } catch (\Throwable $e) {
            Log::error('AI Error: ' . $e->getMessage());
            // Hide noisy internal errors in user-facing response
            if ($e instanceof \OpenAI\Exceptions\TransporterException) {
                return 'AI is temporarily unavailable. Please try again shortly.';
            }
            return 'AI service is currently experiencing issues. Please try again later.';
        }
    }

    /**
     * Simple off-topic detector based on keywords.
     */
    protected function isOffTopic(string $text): bool
    {
        $t = strtolower($text);
        $off = [
            'weather',
            'joke',
            'poem',
            'story',
            'song',
            'personal advice',
            'relationship',
            'movie',
            'recipe',
            'sports',
            'politics',
            'teach me',
            'python tutorial',
            'java tutorial',
            'c++ tutorial',
            'math problem',
            'homework',
            'philosophy',
            'astrology',
            'horoscope'
        ];
        foreach ($off as $kw) {
            if (str_contains($t, $kw)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Build a compact incident context block to inject on each AI call.
     */
    protected function buildIncidentContextBlock(Incident $incident, string $timezone = 'UTC'): string
    {
        $domainName = $incident->domain->name ?? 'N/A';
        $domainUrl = $incident->domain->url ?? 'N/A';
        $httpStatus = $incident->http_status ?? 'N/A';
        $exception = $incident->exception ?: 'N/A';
        $respHeaders = $this->filterResponseHeaders($incident);
        $respHeadersJson = !empty($respHeaders) ? json_encode($respHeaders, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) : 'N/A';
        $bodySnippet = $incident->response_body ? substr($incident->response_body, 0, 2000) : 'N/A';

        return <<<TXT
Incident Context (Isolated):
Domain: {$domainName}
URL: {$domainUrl}
Status: {$incident->status}
HTTP Status: {$httpStatus}
Detection Time (User View): {$incident->started_at->copy()->setTimezone($timezone)->format('M j, Y, H:i:s')}
Incident Resolved Time (User View): {$incident->resolved_at->copy()->setTimezone($timezone)->format('M j, Y, H:i:s')}
Technical Metadata (Internal Only): {$incident->started_at->timestamp}
Key Headers: {$respHeadersJson}
Response body (first 2000 chars):
{$bodySnippet}

Exception (if any): {$exception}
TXT;
    }
}
