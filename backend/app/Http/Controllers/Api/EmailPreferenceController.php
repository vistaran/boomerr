<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class EmailPreferenceController extends Controller
{
    /**
     * Get the current user's email preferences.
     */
    public function show(Request $request)
    {
        $user = $request->user();

        return response()->json([
            'receives_onboarding_emails' => (bool)$user->receives_onboarding_emails,
            'receives_product_updates' => (bool)$user->receives_product_updates,
            'receives_newsletters' => (bool)$user->receives_newsletters,
            'receives_promotional_emails' => (bool)$user->receives_promotional_emails,
        ]);
    }

    /**
     * Update the current user's email preferences.
     */
    public function update(Request $request)
    {
        $request->validate([
            'receives_onboarding_emails' => 'boolean',
            'receives_product_updates' => 'boolean',
            'receives_newsletters' => 'boolean',
            'receives_promotional_emails' => 'boolean',
        ]);

        $user = $request->user();

        $user->update($request->only([
            'receives_onboarding_emails',
            'receives_product_updates',
            'receives_newsletters',
            'receives_promotional_emails'
        ]));

        Log::info("User {$user->id} updated email preferences");

        return response()->json([
            'message' => 'Email preferences updated successfully',
            'preferences' => $user->only([
                'receives_onboarding_emails',
                'receives_product_updates',
                'receives_newsletters',
                'receives_promotional_emails'
            ])
        ]);
    }
}
