<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class ContactSalesController extends Controller
{
    public function contact(Request $request)
    {
        try {
            $user = $request->user();

            $validated = Validator::make($request->all(), [
                'message' => 'required|string|max:2000',
                'workspace' => 'nullable|string|max:255',
            ])->validate();

            // Send Discord notification
            $discordWebhookUrl = env('DISCORD_SALES_WEBHOOK');
            if ($discordWebhookUrl) {
                $content = "📩 **Enterprise Plan Inquiry**\n" .
                    "**Name:** {$user->name}\n" .
                    "**Email:** {$user->email}\n" .
                    "**Message:** {$validated['message']}\n" .
                    "**User ID:** {$user->id}\n";
                $workspace = $validated['workspace'] ?? null;
                if ($workspace) {
                    $content .= "**Workspace:** {$workspace}\n";
                }
                Http::post($discordWebhookUrl, [
                    'content' => $content
                ]);
            }

            // Optionally, send email or store in DB here

            return response()->json(['success' => true]);
        } catch (\Throwable $e) {
            // Optionally log error
            Log::error('Failed to send Discord notification: ' . $e->getMessage());
            return response()->json(['success' => false, 'error' => 'Failed to send message. Please try again later.'], 500);
        }
    }
}
