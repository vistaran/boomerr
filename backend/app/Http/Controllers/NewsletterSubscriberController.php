<?php

namespace App\Http\Controllers;

use App\Mail\Newsletter\NewBlogPublishedMail;
use App\Models\NewsletterSubscriber;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class NewsletterSubscriberController extends Controller
{
    /**
     * Subscribe an email to blog notifications.
     * POST /api/newsletter/subscribe
     */
    public function subscribe(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => 'required|email|max:255',
            'captcha_token' => 'nullable|string',
        ]);

        // Verify hCaptcha if token provided
        if (!empty($validated['captcha_token'])) {
            if (!($validated['captcha_token'] === 'test-token' && app()->environment('local', 'testing'))) {
                if (!$this->verifyHCaptcha($validated['captcha_token'], $request->ip())) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Captcha verification failed. Please try again.',
                    ], 422);
                }
            }
        }

        $email = strtolower(trim($validated['email']));

        $subscriber = NewsletterSubscriber::where('email', $email)->first();

        if ($subscriber) {
            if ($subscriber->is_active) {
                return response()->json([
                    'success' => true,
                    'message' => 'You are already subscribed to Boomerr blog notifications!',
                    'status' => 'already_subscribed',
                ], 200);
            }

            // Reactivate previous subscription
            $subscriber->resubscribe();

            return response()->json([
                'success' => true,
                'message' => 'Welcome back! You have been successfully resubscribed to blog notifications.',
                'status' => 'resubscribed',
            ], 200);
        }

        // Create new subscriber
        NewsletterSubscriber::create([
            'email' => $email,
            'is_active' => true,
            'confirmed_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Thank you for subscribing! You will receive an email whenever a new blog is published.',
            'status' => 'subscribed',
        ], 201);
    }

    /**
     * Look up subscriber status by token for the unsubscribe screen.
     * GET /api/newsletter/status/{token}
     */
    public function status(string $token): JsonResponse
    {
        $subscriber = NewsletterSubscriber::where('token', $token)->first();

        if (!$subscriber) {
            return response()->json([
                'success' => false,
                'message' => 'Subscription record not found or link has expired.',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'email' => $this->maskEmail($subscriber->email),
            'full_email' => $subscriber->email,
            'is_active' => (bool) $subscriber->is_active,
            'unsubscribed_at' => $subscriber->unsubscribed_at,
        ], 200);
    }

    /**
     * Unsubscribe from blog notifications.
     * POST /api/newsletter/unsubscribe
     */
    public function unsubscribe(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token' => 'required|string|max:100',
        ]);

        $subscriber = NewsletterSubscriber::where('token', $validated['token'])->first();

        if (!$subscriber) {
            return response()->json([
                'success' => false,
                'message' => 'Subscription record not found or token is invalid.',
            ], 404);
        }

        if (!$subscriber->is_active) {
            return response()->json([
                'success' => true,
                'message' => 'You are already unsubscribed from blog notifications.',
                'status' => 'already_unsubscribed',
            ], 200);
        }

        $subscriber->unsubscribe();

        return response()->json([
            'success' => true,
            'message' => 'You have been successfully unsubscribed from blog notifications.',
            'status' => 'unsubscribed',
        ], 200);
    }

    /**
     * Resubscribe from the unsubscribe screen.
     * POST /api/newsletter/resubscribe
     */
    public function resubscribe(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token' => 'required|string|max:100',
        ]);

        $subscriber = NewsletterSubscriber::where('token', $validated['token'])->first();

        if (!$subscriber) {
            return response()->json([
                'success' => false,
                'message' => 'Subscription record not found or token is invalid.',
            ], 404);
        }

        $subscriber->resubscribe();

        return response()->json([
            'success' => true,
            'message' => 'You have been resubscribed to Boomerr blog notifications.',
            'status' => 'resubscribed',
        ], 200);
    }

    /**
     * Broadcast notification when a new blog is published.
     * POST /api/newsletter/notify-blog
     */
    public function notifyNewBlog(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'slug' => 'required|string|max:255',
            'excerpt' => 'nullable|string',
            'seo_description' => 'nullable|string',
            'content' => 'nullable|string',
            'featured_image' => 'nullable|string',
            'published_date' => 'nullable|string',
            'avg_read_time' => 'nullable|integer',
            'author_name' => 'nullable|string',
        ]);

        $subscribers = NewsletterSubscriber::active()->get();

        Log::info("[Newsletter] Received publish event for blog '{$validated['title']}' (slug: {$validated['slug']}). Found {$subscribers->count()} active subscriber(s).");

        if ($subscribers->isEmpty()) {
            return response()->json([
                'success' => true,
                'message' => 'No active subscribers found to notify.',
                'sent_count' => 0,
            ], 200);
        }

        $count = 0;
        foreach ($subscribers as $subscriber) {
            try {
                Mail::to($subscriber->email)->queue(new NewBlogPublishedMail($subscriber, $validated));
                Log::info("[Newsletter] Dispatched notification email job to queue for subscriber: {$subscriber->email}");
                $count++;
            } catch (\Throwable $e) {
                Log::error("[Newsletter] Failed to queue blog notification to {$subscriber->email}: " . $e->getMessage());
            }
        }

        return response()->json([
            'success' => true,
            'message' => "Blog notification queued for {$count} active subscribers.",
            'sent_count' => $count,
        ], 200);
    }

    /**
     * Validate hCaptcha response with hCaptcha servers.
     */
    private function verifyHCaptcha(?string $token, ?string $ip): bool
    {
        if (empty($token)) {
            return false;
        }

        // Support both website secret and backend default secret
        $secrets = array_filter(array_unique([
            env('WEBSITE_HCAPTCHA_SECRET_KEY'),
            config('services.hcaptcha.secret'),
        ]));

        if (empty($secrets)) {
            return true; // Pass in environments where hCaptcha secret is not configured
        }

        foreach ($secrets as $secret) {
            try {
                $response = Http::withoutVerifying()->asForm()->timeout(5)->post(
                    'https://hcaptcha.com/siteverify',
                    [
                        'secret' => $secret,
                        'response' => $token,
                        'remoteip' => $ip,
                    ]
                );

                $data = $response->json();
                if (!empty($data['success'])) {
                    return true;
                }

                Log::info('hCaptcha verification failure response', [
                    'secret_prefix' => substr($secret, 0, 6) . '...',
                    'response' => $data,
                ]);
            } catch (\Throwable $e) {
                Log::error('Newsletter hCaptcha verification error: ' . $e->getMessage());
            }
        }

        return false;
    }

    /**
     * Mask email for privacy on the unsubscribe page (e.g. j***e@domain.com)
     */
    private function maskEmail(string $email): string
    {
        $parts = explode('@', $email);
        if (count($parts) !== 2) {
            return $email;
        }

        $name = $parts[0];
        $domain = $parts[1];

        if (strlen($name) <= 2) {
            $maskedName = substr($name, 0, 1) . '*';
        } else {
            $maskedName = substr($name, 0, 1) . str_repeat('*', min(4, strlen($name) - 2)) . substr($name, -1);
        }

        return $maskedName . '@' . $domain;
    }
}
