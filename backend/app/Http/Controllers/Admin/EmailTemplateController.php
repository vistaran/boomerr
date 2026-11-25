<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\EmailTemplate;
use App\Models\User;
use App\Jobs\ProcessLifecycleAutomations;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Blade;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class EmailTemplateController extends Controller
{
    /**
     * Get all email templates with optional filtering.
     */
    public function index(Request $request)
    {
        $query = EmailTemplate::query();

        if ($request->filled('category')) {
            $query->where('category', $request->query('category'));
        }

        if ($request->filled('sequence') || $request->filled('sequence_name')) {
            $seq = $request->query('sequence') ?: $request->query('sequence_name');
            $query->where('sequence_name', $seq);
        }

        if ($request->has('is_active')) {
            $query->where('is_active', filter_var($request->query('is_active'), FILTER_VALIDATE_BOOLEAN));
        }

        if ($request->filled('search')) {
            $search = '%' . $request->query('search') . '%';
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', $search)
                  ->orWhere('key', 'like', $search)
                  ->orWhere('subject', 'like', $search)
                  ->orWhere('sequence_name', 'like', $search)
                  ->orWhere('description', 'like', $search);
            });
        }

        $templates = $query->orderBy('sequence_name')->orderBy('step_order')->orderBy('id')->get();

        return response()->json([
            'success' => true,
            'count' => $templates->count(),
            'data' => $templates
        ]);
    }

    /**
     * Get a single email template by ID or Key.
     */
    public function show($idOrKey)
    {
        $template = $this->findTemplate($idOrKey);

        if (!$template) {
            return response()->json([
                'success' => false,
                'message' => 'Email template not found.'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $template
        ]);
    }

    /**
     * Create a new email template.
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'key' => 'required|string|max:100|unique:email_templates,key|regex:/^[a-zA-Z0-9_\-]+$/',
            'name' => 'required|string|max:150',
            'category' => 'nullable|string|max:50',
            'sequence_name' => 'nullable|string|max:100',
            'step_order' => 'nullable|integer',
            'delay_value' => 'nullable|integer|min:0',
            'delay_unit' => 'nullable|string|in:hours,days,weeks,months',
            'trigger_event' => 'nullable|string|max:100',
            'trigger_condition' => 'nullable|string|max:255',
            'subject' => 'required|string|max:255',
            'body_html' => 'required|string',
            'body_plain' => 'nullable|string',
            'variables' => 'nullable|array',
            'description' => 'nullable|string',
            'is_active' => 'nullable|boolean',
        ], [
            'key.regex' => 'The key may only contain letters, numbers, dashes, and underscores.'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $validated = $validator->validated();
        $validated['category'] = $validated['category'] ?? 'onboarding';
        $validated['is_active'] = $validated['is_active'] ?? true;

        $template = EmailTemplate::create($validated);

        return response()->json([
            'success' => true,
            'message' => 'Email template created successfully.',
            'data' => $template
        ], 201);
    }

    /**
     * Update an existing email template.
     */
    public function update(Request $request, $idOrKey)
    {
        $template = $this->findTemplate($idOrKey);

        if (!$template) {
            return response()->json([
                'success' => false,
                'message' => 'Email template not found.'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'key' => [
                'sometimes',
                'string',
                'max:100',
                Rule::unique('email_templates', 'key')->ignore($template->id),
                'regex:/^[a-zA-Z0-9_\-]+$/'
            ],
            'name' => 'sometimes|string|max:150',
            'category' => 'nullable|string|max:50',
            'sequence_name' => 'nullable|string|max:100',
            'step_order' => 'nullable|integer',
            'delay_value' => 'nullable|integer|min:0',
            'delay_unit' => 'nullable|string|in:hours,days,weeks,months',
            'trigger_event' => 'nullable|string|max:100',
            'trigger_condition' => 'nullable|string|max:255',
            'subject' => 'sometimes|string|max:255',
            'body_html' => 'sometimes|string',
            'body_plain' => 'nullable|string',
            'variables' => 'nullable|array',
            'description' => 'nullable|string',
            'is_active' => 'nullable|boolean',
        ], [
            'key.regex' => 'The key may only contain letters, numbers, dashes, and underscores.'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $template->update($validator->validated());

        return response()->json([
            'success' => true,
            'message' => 'Email template updated successfully.',
            'data' => $template
        ]);
    }

    /**
     * Delete an email template.
     */
    public function destroy($idOrKey)
    {
        $template = $this->findTemplate($idOrKey);

        if (!$template) {
            return response()->json([
                'success' => false,
                'message' => 'Email template not found.'
            ], 404);
        }

        $template->delete();

        return response()->json([
            'success' => true,
            'message' => "Email template '{$template->key}' deleted successfully."
        ]);
    }

    /**
     * Preview / live render an email template with sample or custom variables.
     */
    public function preview(Request $request, $idOrKey)
    {
        if ($idOrKey === 'draft' || $idOrKey === 'new') {
            $template = new EmailTemplate([
                'key' => $request->input('key', 'draft_preview'),
                'name' => $request->input('name', 'Draft Preview'),
                'subject' => $request->input('subject', 'Preview Subject'),
                'body_html' => $request->input('body_html', '<p>Preview content</p>'),
            ]);
        } else {
            $template = $this->findTemplate($idOrKey);
        }

        if (!$template) {
            return response()->json([
                'success' => false,
                'message' => 'Email template not found.'
            ], 404);
        }

        // Allow previewing unsaved changes
        if ($request->filled('body_html')) {
            $template->body_html = $request->input('body_html');
        }
        if ($request->filled('subject')) {
            $template->subject = $request->input('subject');
        }

        $defaultMockData = $this->buildMockData($template);
        $data = array_merge($defaultMockData, $request->input('data', []));

        try {
            $renderedSubject = $template->renderSubject($data);
            $renderedHtml = $template->render($data);

            if ($request->query('format') === 'html') {
                return response($renderedHtml, 200, ['Content-Type' => 'text/html']);
            }

            return response()->json([
                'success' => true,
                'key' => $template->key,
                'subject' => $renderedSubject,
                'html' => $renderedHtml
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error rendering template: ' . $e->getMessage(),
                'trace' => config('app.debug') ? $e->getTraceAsString() : null
            ], 500);
        }
    }

    /**
     * Send a test email of the template to an admin or designated email address.
     */
    public function testSend(Request $request, $idOrKey)
    {
        $template = $this->findTemplate($idOrKey);

        if (!$template) {
            return response()->json([
                'success' => false,
                'message' => 'Email template not found.'
            ], 404);
        }

        $targetEmail = $request->input('email') ?: ($request->user()?->email ?: 'admin@example.com');

        if (!filter_var($targetEmail, FILTER_VALIDATE_EMAIL)) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid destination email address provided.'
            ], 422);
        }

        $mockData = $this->buildMockData($template);
        if ($request->has('data') && is_array($request->input('data'))) {
            $mockData = array_merge($mockData, $request->input('data'));
        }

        try {
            $renderedSubject = '[TEST] ' . $template->renderSubject($mockData);
            $renderedHtml = $template->render($mockData);

            Mail::html($renderedHtml, function ($message) use ($targetEmail, $renderedSubject) {
                $message->to($targetEmail)
                        ->subject($renderedSubject);
            });

            return response()->json([
                'success' => true,
                'message' => "Test email for '{$template->name}' sent successfully to {$targetEmail}."
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed sending test email: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Trigger / test run the sequence automation runner.
     */
    public function triggerRun(Request $request)
    {
        $user = null;
        if ($request->filled('user_id')) {
            $user = User::find($request->input('user_id'));
            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'Target user not found.'
                ], 404);
            }
        } elseif ($request->filled('email')) {
            $user = User::where('email', $request->input('email'))->first();
            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'Target user with specified email not found.'
                ], 404);
            }
        }

        if ($user) {
            ProcessLifecycleAutomations::dispatch($user);
            $msg = "Lifecycle automations job dispatched for user '{$user->email}'.";
        } else {
            ProcessLifecycleAutomations::dispatch();
            $msg = "Lifecycle automations job dispatched for all users.";
        }

        return response()->json([
            'success' => true,
            'message' => $msg
        ]);
    }

    /**
     * Build rich sample preview/test data matching all platform events.
     */
    protected function buildMockData(?EmailTemplate $template = null): array
    {
        return [
            'firstName' => 'Alex',
            'user' => (object) [
                'name' => 'Alex Rivera',
                'email' => 'alex@example.com',
            ],
            'unsubscribeUrl' => (config('app.frontend_url') ?? config('app.url', 'http://localhost:8080')) . '/email-preferences',
            'url' => (config('app.frontend_url') ?? config('app.url', 'http://localhost:8080')) . '/verify-email?token=preview-token-123456',
            'acceptUrl' => (config('app.frontend_url') ?? config('app.url', 'http://localhost:8080')) . '/accept-invitation/preview-invitation-token',
            'inviteUrl' => (config('app.frontend_url') ?? config('app.url', 'http://localhost:8080')) . '/accept-invitation/preview-invitation-token',
            'invitation' => (object) [
                'token' => 'preview-invitation-token',
                'workspace_name' => 'Acme Corporation',
            ],
            'inviterName' => 'Alex Rivera',
            'workspaceName' => 'Acme Corporation',
            'companyName' => 'Acme Corporation',
            'otpCode' => '794218',
            'domain' => new class(['name' => 'example.com', 'url' => 'https://example.com']) extends \ArrayObject {
                public function __get($key) { return $this[$key] ?? null; }
            },
            'event' => (object) [
                'region' => 'us-east-1',
                'response_time_ms' => 142,
                'checked_at' => now()->toIso8601String(),
            ],
            'downtimeDuration' => '3 minutes 42 seconds',
            'incident' => (object) [
                'incident_id' => 'INC-784920',
                'incident_title' => 'API Gateway Elevated Latency',
                'incident_status' => 'investigating',
                'incident_impact' => 'Degraded Performance on Checkout Endpoints',
                'incident_affected_services' => ['API Gateway', 'US-East Monitoring Probes'],
                'incident_started_at' => now()->subMinutes(14),
                'incident_resolved_at' => now(),
                'duration' => '14 minutes',
                'incident_cause' => 'Upstream DNS provider packet routing issue.',
            ],
            'subscriber' => (object) [
                'email' => 'subscriber@example.com',
            ],
            'changes' => [
                [
                    'field' => 'SSL Certificate',
                    'before' => 'Expiring in 5 days',
                    'after' => 'Renewed (Valid for 365 days)',
                ],
                [
                    'field' => 'A Record IP',
                    'before' => '76.76.21.20',
                    'after' => '76.76.21.21',
                ],
            ],
            'action' => 'updated',
            'summary' => 'Domain settings and SSL configuration were updated',
            'environment' => 'Production',
            'actor' => 'Alex Rivera',
            'title' => 'Domain Configuration Changed',
            'timestamp' => now()->toDateTimeString(),
            'oldData' => [
                'ip' => '76.76.21.20',
                'ssl_status' => 'expiring',
            ],
            'newData' => [
                'ip' => '76.76.21.21',
                'ssl_status' => 'valid',
            ],
            'blogTitle' => 'How We Scaled Multi-Region Synthetic Probes to 10M Pings/Day',
            'blogExcerpt' => 'Discover the edge networking strategies we used to reduce synthetic latency across 12 worldwide monitoring zones.',
            'blogUrl' => (config('app.frontend_url') ?? config('app.url', 'http://localhost:8080')) . '/blog/scaling-multi-region-checks',
            'blogAuthor' => 'Boomerr Engineering Team',
            'publishedAt' => now()->toFormattedDateString(),
            'uptimePercentage' => '99.98%',
            'totalIncidents' => 1,
            'industryNews' => 'Major cloud providers saw an 11% increase in routing anomalies this week. Are your multi-region checks ready?',
            'featureSpotlight' => 'Did you know you can connect Slack or Discord to receive instant incident reports?',
            'educationalTip' => 'Configuring keyword assertions guarantees your site is actually loading valid content.',
        ];
    }

    /**
     * Find template by ID or key string.
     */
    protected function findTemplate($idOrKey): ?EmailTemplate
    {
        if (is_numeric($idOrKey)) {
            return EmailTemplate::find($idOrKey);
        }

        return EmailTemplate::where('key', $idOrKey)->first();
    }
}
