<?php

namespace App\Http\Controllers;

use App\Models\Webhook;
use App\Models\WebhookEvent;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class DeveloperWebhookController extends Controller
{
    public function index(Request $request)
    {
        $workspaceId = $request->user()->workspace_id;
        $webhooks = Webhook::where('workspace_id', $workspaceId)
            ->with('events')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($webhooks);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'url' => ['required', 'url', 'starts_with:https://', 'max:255'],
            'enabled' => 'boolean',
            'retry_enabled' => 'boolean',
            'timeout' => 'integer|min:1|max:30',
            'events' => 'required|array|max:10',
            'events.*' => ['string', 'distinct', \Illuminate\Validation\Rule::in(['Domain Up', 'Domain Down', 'SSL Expiring', 'SSL Expired'])]
        ]);

        // SSRF Guard
        \App\Helpers\SecurityHelper::validateUrl($validated['url']);

        $workspaceId = $request->user()->workspace_id;
        $secret = 'whsec_' . Str::random(32);

        $webhook = Webhook::create([
            'workspace_id' => $workspaceId,
            'name' => $validated['name'],
            'url' => $validated['url'],
            'secret' => $secret,
            'enabled' => $validated['enabled'] ?? true,
            'retry_enabled' => $validated['retry_enabled'] ?? true,
            'timeout' => $validated['timeout'] ?? 10,
        ]);

        $events = array_map(function ($eventName) use ($webhook) {
            return [
                'webhook_id' => $webhook->id,
                'event_name' => $eventName,
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }, $validated['events']);
        
        WebhookEvent::insert($events);

        return response()->json($webhook->load('events'), 201);
    }

    public function update(Request $request, $id)
    {
        $validated = $request->validate([
            'name' => 'string|max:255',
            'url' => ['url', 'starts_with:https://', 'max:255'],
            'enabled' => 'boolean',
            'retry_enabled' => 'boolean',
            'timeout' => 'integer|min:1|max:30',
            'events' => 'array|max:10',
            'events.*' => ['string', 'distinct', \Illuminate\Validation\Rule::in(['Domain Up', 'Domain Down', 'SSL Expiring', 'SSL Expired'])]
        ]);

        if (isset($validated['url'])) {
            \App\Helpers\SecurityHelper::validateUrl($validated['url']);
        }

        $workspaceId = $request->user()->workspace_id;
        $webhook = Webhook::where('workspace_id', $workspaceId)->findOrFail($id);

        $webhook->update(array_intersect_key($validated, array_flip(['name', 'url', 'enabled', 'retry_enabled', 'timeout'])));

        if (isset($validated['events'])) {
            $webhook->events()->delete();
            $events = array_map(function ($eventName) use ($webhook) {
                return [
                    'webhook_id' => $webhook->id,
                    'event_name' => $eventName,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            }, $validated['events']);
            
            WebhookEvent::insert($events);
        }

        return response()->json($webhook->load('events'));
    }

    public function destroy(Request $request, $id)
    {
        $workspaceId = $request->user()->workspace_id;
        $webhook = Webhook::where('workspace_id', $workspaceId)->findOrFail($id);
        $webhook->delete();

        return response()->json(['message' => 'Webhook deleted successfully']);
    }

    public function test(Request $request, $id)
    {
        $workspaceId = $request->user()->workspace_id;
        $webhook = Webhook::where('workspace_id', $workspaceId)->findOrFail($id);

        $payload = [
            'event' => 'TEST',
            'timestamp' => now()->toIso8601String(),
            'message' => 'This is a test webhook from Boomer Monitoring.'
        ];

        \App\Jobs\DispatchWebhookJob::dispatch($webhook, $payload, 'TEST', null);

        return response()->json(['message' => 'Test payload queued for delivery. Check delivery logs for status.']);
    }

    public function deliveries(Request $request, $id)
    {
        $workspaceId = $request->user()->workspace_id;
        $webhook = Webhook::where('workspace_id', $workspaceId)->findOrFail($id);

        $deliveries = $webhook->deliveries()->orderBy('created_at', 'desc')->paginate(20);

        return response()->json($deliveries);
    }
}
