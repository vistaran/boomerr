<?php

namespace App\Providers;

use App\Events\DomainStatusUpdated;
use Illuminate\Validation\Rules\Password;
use App\Listeners\HandleDomainStatusForFacebookAds;
use App\Listeners\HandleDomainStatusForGoogleAds;
use App\Models\Domain;
use App\Observers\DatabaseNotificationObserver;
use App\Observers\DomainObserver;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Schema;
use App\Listeners\WebhookEventSubscriber;
use App\Contracts\SmsProviderInterface;
use App\Contracts\WhatsAppProviderInterface;
use App\Services\FacebookWhatsAppService;
use App\Services\IpBanService;
use App\Services\SMS\Msg91\Msg91SmsService;
use App\Services\SMS\Twilio\TwilioSmsService;
use App\Services\TwilioWhatsAppService;
use Illuminate\Support\ServiceProvider;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;


class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(SmsProviderInterface::class, function ($app) {
            $provider = strtolower((string) config('services.sms.provider', 'msg91'));

            return match ($provider) {
                'twilio' => $app->make(TwilioSmsService::class),
                'msg91' => $app->make(Msg91SmsService::class),
                default => $app->make(Msg91SmsService::class),
            };
        });

        $this->app->bind(WhatsAppProviderInterface::class, function ($app) {
            $provider = strtolower((string) config('services.whatsapp.provider', 'facebook'));

            return match ($provider) {
                'twilio' => $app->make(TwilioWhatsAppService::class),
                'facebook', 'meta' => $app->make(FacebookWhatsAppService::class),
                default => $app->make(FacebookWhatsAppService::class),
            };
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Schema::defaultStringLength(191);

        Domain::observe(DomainObserver::class);
        DatabaseNotification::observe(DatabaseNotificationObserver::class);

        // Register event listeners
        Event::listen(
            DomainStatusUpdated::class,
            HandleDomainStatusForFacebookAds::class
        );

        Event::listen(
            DomainStatusUpdated::class,
            HandleDomainStatusForGoogleAds::class
        );

        ResetPassword::createUrlUsing(function (object $notifiable, string $token) {
            return config('app.frontend_url') . "/password-reset/$token?email={$notifiable->getEmailForPasswordReset()}";
        });

        // Define rate limiters
        RateLimiter::for('api', function (Request $request) {
            $key = $request->user()?->id ?: $request->ip();

            return Limit::perMinute(60)
                ->by($key)
                ->response(function () {
                    return response()->json([
                        'status' => 'error',
                        'message' => 'Too many requests. Please slow down.'
                    ], 429);
                });
        });

        RateLimiter::for('login', function (Request $request) {
            return Limit::perMinute(30)->by($request->ip());
        });

        RateLimiter::for('register', function (Request $request) {
            return Limit::perMinute(30)->by($request->ip());
        });

        Password::defaults(function () {
            return Password::min(1)
                ->mixedCase()
                ->numbers()
                ->symbols();
        });
    }
}
