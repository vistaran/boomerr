<?php

namespace App\Http\Controllers;

use App\Models\Domain;
use App\Models\DomainIntegration;
use App\Models\NotificationChannel;
use App\Models\TelegramConnectionToken;
use App\Models\User;
use App\Services\TelegramNotifier;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class TelegramIntegrationController extends Controller
{
    /**
     * Generate a connection deep-link for Telegram.
     */
    public function connect(Request $request, $domain_ulid)
    {
        try {
            $user = Auth::user();
            if (!($user instanceof User) || !$user->currentWorkspace()) {
                return response()->json(['message' => 'Unauthenticated or not in workspace'], 401);
            }

            $domain = Domain::where('ulid', $domain_ulid)->firstOrFail();

            if ($domain->workspace_id !== $user->currentWorkspaceId() && $domain->company_id !== $user->currentWorkspaceId()) {
                return response()->json(['message' => 'Forbidden'], 403);
            }

            $validated = $request->validate([
                'integration_ulid' => ['required', 'exists:domain_integrations,ulid'],
                'events' => ['sometimes', 'array'],
                'events.*' => ['string'],
                'reconnect_channel_ulid' => ['sometimes', 'string'],
            ]);

            $domainIntegration = DomainIntegration::where('ulid', $validated['integration_ulid'])->firstOrFail();

            if (!$domainIntegration->enabled) {
                $domainIntegration->enabled = true;
                $domainIntegration->save();
            }

            $tokenString = Str::random(32);
            
            if (!empty($validated['reconnect_channel_ulid'])) {
                \Illuminate\Support\Facades\Cache::put("telegram_reconnect_{$tokenString}", $validated['reconnect_channel_ulid'], now()->addMinutes(20));
            }

            $token = TelegramConnectionToken::create([
                'token' => $tokenString,
                'workspace_id' => $user->currentWorkspaceId(),
                'domain_id' => $domain->id,
                'integration_id' => $domainIntegration->id,
                'user_id' => $user->id,
                'events' => $validated['events'] ?? ['Domain Up', 'Domain Down', 'SSL Expiring', 'SSL Expired'],
                'expires_at' => now()->addMinutes(15),
            ]);

            $botUsername = config('services.telegram.bot_username');
            $deepLink = "https://t.me/{$botUsername}?start={$tokenString}";

            return response()->json([
                'url' => $deepLink,
                'token' => $tokenString,
                'expires_at' => $token->expires_at,
            ]);
        } catch (\Throwable $e) {
            Log::error('Telegram connect failed: ' . $e->getMessage());
            return response()->json(['message' => 'Server error', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Polling endpoint for frontend to check connection status.
     */
    public function status(Request $request, $tokenString)
    {
        try {
            $user = Auth::user();
            if (!($user instanceof User)) {
                return response()->json(['message' => 'Unauthenticated'], 401);
            }

            $token = TelegramConnectionToken::where('token', $tokenString)
                ->where('user_id', $user->id)
                ->first();

            if (!$token) {
                return response()->json(['message' => 'Token not found'], 404);
            }

            if ($token->isExpired() && !$token->isUsed()) {
                return response()->json(['status' => 'expired']);
            }

            if ($token->isUsed()) {
                return response()->json(['status' => 'connected']);
            }

            return response()->json(['status' => 'pending']);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Server error'], 500);
        }
    }

    /**
     * Handle incoming webhooks from Telegram.
     */
    public function webhook(Request $request)
    {
        try {
            Log::info('Telegram Webhook Received:', $request->all());

            // Verify Telegram secret token
            $expectedSecret = config('services.telegram.webhook_secret');
            $providedSecret = $request->header('X-Telegram-Bot-Api-Secret-Token');

            if ($expectedSecret && $providedSecret !== $expectedSecret) {
                Log::warning('Telegram webhook invalid secret token');
                return response()->json(['message' => 'Unauthorized'], 401);
            }

            // Handle callback queries (Inline keyboard button clicks)
            if ($request->has('callback_query')) {
                $callbackQuery = $request->input('callback_query');
                $chatId = $callbackQuery['message']['chat']['id'] ?? null;
                $data = $callbackQuery['data'] ?? '';
                $callbackQueryId = $callbackQuery['id'];

                $botToken = config('services.telegram.bot_token');

                if ($chatId && str_starts_with($data, 'cfg_dom:')) {
                    $channelUlid = substr($data, strlen('cfg_dom:'));
                    $channel = NotificationChannel::where('ulid', $channelUlid)->first();
                    
                    if ($channel) {
                        $domainName = $channel->domain ? $channel->domain->name : 'Workspace Alerts';
                        \Illuminate\Support\Facades\Http::post("https://api.telegram.org/bot{$botToken}/editMessageText", [
                            'chat_id' => $chatId,
                            'message_id' => $callbackQuery['message']['message_id'],
                            'text' => "⚙️ <b>Alert Preferences - {$domainName}</b>\n\nTap the buttons below to toggle which alerts you want to receive for this domain.",
                            'parse_mode' => 'HTML',
                            'reply_markup' => $this->buildSettingsKeyboard($channel),
                        ]);
                        \Illuminate\Support\Facades\Http::post("https://api.telegram.org/bot{$botToken}/answerCallbackQuery", [
                            'callback_query_id' => $callbackQueryId,
                        ]);
                    }
                } elseif ($chatId && $data === 'tg_back') {
                    $channels = NotificationChannel::with('domain')->where('url', (string) $chatId)->where('type', 'telegram')->get();
                    if ($channels->isNotEmpty()) {
                        \Illuminate\Support\Facades\Http::post("https://api.telegram.org/bot{$botToken}/editMessageText", [
                            'chat_id' => $chatId,
                            'message_id' => $callbackQuery['message']['message_id'],
                            'text' => "🏢 <b>Select Domain</b>\n\nWhich domain's alerts would you like to configure?",
                            'parse_mode' => 'HTML',
                            'reply_markup' => $this->buildDomainsKeyboard($channels),
                        ]);
                    }
                    \Illuminate\Support\Facades\Http::post("https://api.telegram.org/bot{$botToken}/answerCallbackQuery", [
                        'callback_query_id' => $callbackQueryId,
                    ]);
                } elseif ($chatId && str_starts_with($data, 'tg_evt:')) {
                    // format: tg_evt:{ulid}:{event}
                    $parts = explode(':', $data, 3);
                    if (count($parts) === 3) {
                        $channelUlid = $parts[1];
                        $eventToToggle = $parts[2];
                        
                        $channel = NotificationChannel::where('ulid', $channelUlid)->first();

                        if ($channel) {
                            $currentEvents = $channel->events ?? [];
                            if (in_array($eventToToggle, $currentEvents)) {
                                $currentEvents = array_filter($currentEvents, fn($e) => $e !== $eventToToggle);
                            } else {
                                $currentEvents[] = $eventToToggle;
                            }
                            
                            $channel->events = array_values($currentEvents);
                            $channel->save();

                            \Illuminate\Support\Facades\Http::post("https://api.telegram.org/bot{$botToken}/editMessageReplyMarkup", [
                                'chat_id' => $chatId,
                                'message_id' => $callbackQuery['message']['message_id'],
                                'reply_markup' => $this->buildSettingsKeyboard($channel),
                            ]);

                            \Illuminate\Support\Facades\Http::post("https://api.telegram.org/bot{$botToken}/answerCallbackQuery", [
                                'callback_query_id' => $callbackQueryId,
                                'text' => "Updated: {$eventToToggle}",
                            ]);
                        }
                    }
                }
                
                return response()->json(['message' => 'Ok']);
            }

            $message = $request->input('message');

            if (!$message) {
                return response()->json(['message' => 'Ok']); // Ignore non-message updates
            }

            $text = $message['text'] ?? '';
            $chatId = $message['chat']['id'] ?? null;
            $chatType = $message['chat']['type'] ?? 'private';

            if (!$chatId || !$text) {
                return response()->json(['message' => 'Ok']);
            }

            // Check if it's a /settings command
            if (preg_match('/^\/settings/i', $text)) {
                $channels = NotificationChannel::with('domain')
                    ->where('url', (string) $chatId)
                    ->where('type', 'telegram')
                    ->get();

                if ($channels->isNotEmpty()) {
                    TelegramNotifier::send($chatId, [
                        'text' => "🏢 <b>Select Domain</b>\n\nWhich domain's alerts would you like to configure?",
                        'parse_mode' => 'HTML',
                        'reply_markup' => $this->buildDomainsKeyboard($channels),
                    ]);
                } else {
                    TelegramNotifier::send($chatId, [
                        'text' => "❌ This chat is not connected to Boomerr yet.",
                    ]);
                }
                return response()->json(['message' => 'Ok']);
            }

            // Check if it's a /start command
            if (preg_match('/^\/start(?:@[a-zA-Z0-9_]+)?\s+([a-zA-Z0-9]{32})/i', $text, $matches)) {
                $tokenString = $matches[1];
                $tokenPrefix = substr($tokenString, 0, 4) . '...';

                Log::info("Telegram parsing successful for /start command. Token prefix: {$tokenPrefix}");

                $token = TelegramConnectionToken::where('token', $tokenString)->first();

                if (!$token) {
                    Log::warning("Telegram webhook received invalid token. Prefix: {$tokenPrefix}");
                    TelegramNotifier::send($chatId, [
                        'text' => '❌ The connection token is invalid or does not exist.'
                    ]);
                    return response()->json(['message' => 'Invalid token']);
                }

                if ($token->isExpired()) {
                    Log::warning("Telegram webhook received expired token. Prefix: {$tokenPrefix}");
                    TelegramNotifier::send($chatId, [
                        'text' => '❌ The connection token has expired. Please generate a new one from the dashboard.'
                    ]);
                    return response()->json(['message' => 'Token expired']);
                }

                // Check if this is a reconnect
                $reconnectChannelUlid = \Illuminate\Support\Facades\Cache::pull("telegram_reconnect_{$tokenString}");
                $chatName = $message['chat']['title'] ?? ($message['chat']['username'] ?? 'Telegram Chat');
                
                $channel = null;
                if ($reconnectChannelUlid) {
                    $channel = NotificationChannel::where('ulid', $reconnectChannelUlid)->first();
                }

                if (!$channel) {
                    $channel = NotificationChannel::where('url', (string) $chatId)
                        ->where('domain_id', $token->domain_id)
                        ->where('type', 'telegram')
                        ->first();
                }

                if ($channel) {
                    $channel->update([
                        'name' => $chatName,
                        'url' => (string) $chatId,
                        'events' => $token->events,
                        'is_active' => true,
                    ]);
                } else {
                    // Create the Notification Channel
                    $channel = NotificationChannel::create([
                        'workspace_id' => $token->workspace_id,
                        'domain_id' => $token->domain_id,
                        'type' => 'telegram',
                        'integration_id' => $token->integration_id,
                        'name' => $chatName,
                        'url' => (string) $chatId,
                        'events' => $token->events,
                        'is_active' => true,
                    ]);
                }

                // Mark token as used
                $token->used_at = now();
                $token->save();

                $domainName = 'your workspace';
                if ($channel->domain_id) {
                    $domain = \App\Models\Domain::find($channel->domain_id);
                    if ($domain) {
                        $domainName = $domain->name;
                    }
                }

                // Send success message
                $successText = "🎉 <b>Connection Established!</b>\n\n";
                $successText .= "Boomerr is now linked for <b>{$domainName}</b>. We'll instantly notify you here whenever your monitored domains go down or if SSL certificates are expiring.\n\n";
                $successText .= "<i>You can change your notification preferences at any time by sending the /settings command.</i>";

                TelegramNotifier::send($chatId, [
                    'text' => $successText,
                    'parse_mode' => 'HTML',
                    'reply_markup' => $this->buildSettingsKeyboard($channel),
                ], $channel->id);

                return response()->json(['message' => 'Connected']);
            }

            return response()->json(['message' => 'Ok']);
        } catch (\Throwable $e) {
            Log::error('Telegram webhook error: ' . $e->getMessage());
            return response()->json(['message' => 'Server error'], 500);
        }
    }

    /**
     * Build the inline keyboard for domain selection.
     */
    public function buildDomainsKeyboard($channels)
    {
        $keyboard = [];
        foreach ($channels as $channel) {
            $domainName = $channel->domain ? $channel->domain->name : 'Workspace Alerts';
            $keyboard[][] = [
                'text' => "🌐 {$domainName}",
                'callback_data' => "cfg_dom:{$channel->ulid}",
            ];
        }

        return [
            'inline_keyboard' => $keyboard,
        ];
    }

    /**
     * Build the inline keyboard for settings.
     */
    public function buildSettingsKeyboard($channel)
    {
        $allEvents = ['Domain Up', 'Domain Down', 'SSL Expiring', 'SSL Expired'];
        $currentEvents = $channel->events ?? [];

        $keyboard = [];
        foreach ($allEvents as $event) {
            $hasEvent = in_array($event, $currentEvents);
            $icon = $hasEvent ? '✅' : '❌';
            $keyboard[][] = [
                'text' => "{$icon} {$event}",
                'callback_data' => "tg_evt:{$channel->ulid}:{$event}",
            ];
        }

        // Add back button
        $keyboard[][] = [
            'text' => "⬅️ Back to Domains",
            'callback_data' => "tg_back",
        ];

        return [
            'inline_keyboard' => $keyboard,
        ];
    }
}
