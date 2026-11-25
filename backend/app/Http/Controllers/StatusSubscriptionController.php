<?php

namespace App\Http\Controllers;

use App\Models\StatusSubscription;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StatusSubscriptionController extends Controller
{
    /**
     * POST /api/status/subscribe
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => 'required|email|max:255',
        ]);

        StatusSubscription::firstOrCreate(
            ['email' => $validated['email']],
            ['confirmed_at' => now()] // Auto-confirm for MVP (no email verification flow yet)
        );

        return response()->json(['message' => 'You have been subscribed to Boomerr status updates.']);
    }

    /**
     * GET /api/status/unsubscribe/{token}
     */
    public function unsubscribe(string $token): JsonResponse
    {
        $sub = StatusSubscription::where('token', $token)->first();

        if (!$sub) {
            return response()->json(['message' => 'Subscription not found.'], 404);
        }

        $sub->delete();

        return response()->json(['message' => 'You have been unsubscribed from Boomerr status updates.']);
    }
}
