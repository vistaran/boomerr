<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\Integration;
use App\Models\User;
use App\Models\Workspace;
use App\Services\AuditLogService;
use App\Services\Billing\WorkspaceSubscriptionService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Laravel\Socialite\Facades\Socialite;

class GitHubAuthController extends Controller
{
    /**
     * Redirect the user to the GitHub OAuth authorization page.
     */
    public function redirect(): RedirectResponse
    {
        return Socialite::driver('github')->redirect();
    }

    /**
     * Handle the callback from GitHub and issue a Sanctum token.
     */
    public function callback(): RedirectResponse
    {
        $frontendUrl = config('app.frontend_url') ?? config('app.url', 'http://localhost:8080');
        $callbackPath = '/auth/callback';

        try {
            /** @var \Laravel\Socialite\Two\User $githubUser */
            $githubUser = Socialite::driver('github')->user();
        } catch (\Throwable $e) {
            Log::error('GitHub OAuth callback error (Socialite): ' . $e->getMessage());
            return redirect("{$frontendUrl}{$callbackPath}?error=" . urlencode('GitHub authentication failed. Please try again.'));
        }

        // GitHub email can be null if user set their email to private
        $email = $githubUser->getEmail();
        if (!$email) {
            return redirect("{$frontendUrl}{$callbackPath}?error=" . urlencode('Your GitHub account does not have a public email. Please add one and try again.'));
        }

        try {
            // Check if user exists by email OR by github_id
            $user = User::where('email', $email)
                ->orWhere('github_id', $githubUser->getId())
                ->first();

            if ($user) {
                // Existing user - update GitHub fields if not yet linked
                if (!$user->github_id) {
                    $user->github_id = $githubUser->getId();
                    $user->provider = 'github';
                }
                if (!$user->avatar && $githubUser->getAvatar()) {
                    $user->avatar = $githubUser->getAvatar();
                }
                // Mark email as verified (GitHub verified it)
                if (!$user->email_verified_at) {
                    $user->email_verified_at = now();
                }
                $user->save();
            } else {
                // New user - create account
                $user = User::create([
                    'name' => $githubUser->getName() ?? $githubUser->getNickname() ?? 'GitHub User',
                    'email' => $email,
                    'password' => bcrypt(Str::random(32)), // unusable password
                    'github_id' => $githubUser->getId(),
                    'avatar' => $githubUser->getAvatar(),
                    'provider' => 'github',
                    'email_verified_at' => now(),
                ]);

                // Create a workspace for the new user
                $workspace = Workspace::create([
                    'name' => "{$user->name}'s Workspace",
                    'slug' => Str::slug($user->name . '-' . Str::random(5)),
                ]);

                $user->workspaces()->syncWithoutDetaching([
                    $workspace->id => ['role' => User::ROLE_OWNER],
                ]);

                $user->activateWorkspace($workspace->id);

                // Attach all integrations
                Integration::all()->each(
                    fn($i) =>
                    $workspace->integrations()->attach($i->id, [
                        'enabled' => true,
                        'ulid' => strtolower((string) Str::ulid()),
                    ])
                );

                // Ensure free subscription
                app(WorkspaceSubscriptionService::class)->ensureDefaultFreeSubscription($workspace);

                // Send discord signup alert for GitHub signup
                try {
                    app(\App\Services\DiscordAlertService::class)->notifySignup($user, 'github', $workspace->name);
                } catch (\Throwable $e) {
                    Log::error('Discord signup notify failed: ' . $e->getMessage());
                }
            }

            // Ensure workspace is hydrated
            $user->ensureWorkspaceHydrated();
            $user->refresh();

            // Generate Sanctum token
            $token = $user->createToken('github_oauth_token')->plainTextToken;

            // Audit log
            app(AuditLogService::class)->userLogin($user, 'github');

            return redirect("{$frontendUrl}{$callbackPath}?token=" . urlencode($token));
        } catch (\Throwable $e) {
            Log::error('GitHub OAuth callback handler failed: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);

            return redirect("{$frontendUrl}{$callbackPath}?error=" . urlencode('GitHub login failed. Please try again.'));
        }
    }
}
