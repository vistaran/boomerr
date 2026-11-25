<?php

namespace App\Services\Payments;

use App\Services\Payments\Contracts\PaymentGateway;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;
use Razorpay\Api\Api;
use Razorpay\Api\Errors\BadRequestError;
use Illuminate\Http\Request;

class RazorpayService implements PaymentGateway
{
    private const RAZORPAY_MIN_END_TIME = 946684800;
    private const RAZORPAY_MAX_END_TIME = 4765046400;

    protected Api $api;

    public function __construct()
    {
        $this->api = new Api(
            config('billing.razorpay.key'),
            config('billing.razorpay.secret')
        );
    }

    public function createSubscription(array $data): array
    {
        $interval = strtolower((string) ($data['interval'] ?? 'monthly'));
        $defaultTotalCount = $interval === 'yearly' ? 2 : 24;
        $trialDays = max(0, (int) ($data['trial_days'] ?? 0));
        $startAtInput = isset($data['start_at']) ? (int) $data['start_at'] : null;

        // Determine start_at: only send a future timestamp so Razorpay never
        // rejects with "start_at cannot be lesser than the current time".
        // When starting immediately (no trial), omit start_at entirely and let
        // Razorpay default to now.
        $futureThreshold = now()->addMinutes(1)->timestamp;

        if ($startAtInput && $startAtInput > $futureThreshold) {
            $startAt = $startAtInput;
        } elseif ($trialDays > 0) {
            $startAt = now()->addDays($trialDays)->addMinutes(1)->timestamp;
        } else {
            $startAt = null; // let Razorpay start immediately
        }

        $effectiveStartAt = $startAt ?? now()->timestamp;
        $totalCount = $this->resolveTotalCountWithinAllowedEndTime($interval, $defaultTotalCount, $effectiveStartAt);

        $payload = [
            'plan_id' => $data['plan_id'],
            'customer_notify' => 1,
            'total_count' => $totalCount,
        ];

        // Allow creating a subscription for an existing customer so saved
        // payment methods (cards) can be reused by the gateway and users are
        // not prompted for card details every time.
        if (!empty($data['customer_id'])) {
            $payload['customer_id'] = $data['customer_id'];
        }

        if ($startAt !== null) {
            $payload['start_at'] = $startAt;
        }

        $response = $this->api->subscription->create($payload)->toArray();

        return $response;
    }

    private function resolveTotalCountWithinAllowedEndTime(string $interval, int $defaultTotalCount, int $effectiveStartAt): int
    {
        $clampedStartAt = min(max($effectiveStartAt, self::RAZORPAY_MIN_END_TIME), self::RAZORPAY_MAX_END_TIME);

        $start = Carbon::createFromTimestampUTC($clampedStartAt);
        $maxEnd = Carbon::createFromTimestampUTC(self::RAZORPAY_MAX_END_TIME);

        $maxCount = $interval === 'yearly'
            ? $start->diffInYears($maxEnd, false)
            : $start->diffInMonths($maxEnd, false);

        return max(1, min($defaultTotalCount, (int) $maxCount));
    }

    public function cancelSubscription(string $subscriptionId): bool
    {
        if (trim($subscriptionId) === '') {
            return true;
        }

        return $this->cancelWithFallback($subscriptionId, false);
    }

    public function cancelSubscriptionAtCycleEnd(string $subscriptionId): bool
    {
        return $this->cancelWithFallback($subscriptionId, true);
    }

    public function resumeSubscription(string $subscriptionId): array
    {
        return $this->api->subscription->fetch($subscriptionId)->resume(['resumeAt' => 'now'])->toArray();
    }

    public function getSubscriptionDetails(string $subscriptionId): array
    {
        return $this->api->subscription->fetch($subscriptionId)->toArray();
    }

    public function getPublicKey(): string
    {
        return config('billing.razorpay.key');
    }

    public function extractSignature(Request $request): ?string
    {
        return $request->header('X-Razorpay-Signature');
    }

    public function verifyWebhook(string $payload, ?string $signature): bool
    {
        try {
            $this->api->utility->verifyWebhookSignature(
                $payload,
                $signature,
                config('billing.razorpay.webhook_secret')
            );
            return true;
        } catch (\Exception $e) {
            return false;
        }
    }

    public function parseEvent(array $payload): array
    {
        $entity      = $payload['payload']['subscription']['entity'] ?? [];
        $paymentEntity = $payload['payload']['payment']['entity'] ?? [];

        return [
            'type'                 => $payload['event'],
            // Subscription events carry subscription_id in the subscription entity.
            // Payment events carry it inside the payment entity instead.
            'subscription_id'     => $entity['id'] ?? $paymentEntity['subscription_id'] ?? null,
            'customer_id'         => $entity['customer_id'] ?? $paymentEntity['customer_id'] ?? null,
            'current_period_start' => isset($entity['current_start'])
                ? \Carbon\Carbon::createFromTimestamp($entity['current_start'])
                : null,
            'current_period_end'  => isset($entity['current_end'])
                ? \Carbon\Carbon::createFromTimestamp($entity['current_end'])
                : null,
            'payment_id'          => $paymentEntity['id'] ?? null,
            'amount'              => isset($paymentEntity['amount']) ? (int) $paymentEntity['amount'] : null,
            'currency'            => $paymentEntity['currency'] ?? config('billing.default_currency', 'USD'),
        ];
    }

    private function cancelWithFallback(string $subscriptionId, bool $atCycleEnd): bool
    {
        try {
            $subscription = $this->api->subscription->fetch($subscriptionId);
            $status = strtolower($subscription->status);

            if (in_array($status, ['cancelled', 'completed', 'expired'], true)) {
                return true;
            }

            // If no billing cycle exists, immediate cancel only
            if (in_array($status, ['pending', 'created', 'authenticated', 'halted', 'paused'], true)) {
                $atCycleEnd = false;
            }

            $subscription->cancel([
                'cancel_at_cycle_end' => $atCycleEnd ? 1 : 0
            ]);

            return true;
        } catch (BadRequestError $exception) {

            if ($this->isAlreadyCancelledOrInactiveError($exception)) {
                return true;
            }

            if ($this->isSubscriptionMissingError($exception)) {
                return true;
            }

            if ($atCycleEnd && $this->isNoBillingCycleError($exception)) {
                return $this->cancelWithFallback($subscriptionId, false);
            }

            if (!$atCycleEnd && $this->isNoBillingCycleError($exception)) {
                return true;
            }

            throw $exception;
        }
    }

    private function isNoBillingCycleError(BadRequestError $exception): bool
    {
        $message = strtolower($exception->getMessage());

        return str_contains($message, 'billing cycle')
            || str_contains($message, 'no cycle')
            || str_contains($message, 'cycle is not');
    }

    private function isAlreadyCancelledOrInactiveError(BadRequestError $exception): bool
    {
        $message = strtolower($exception->getMessage());

        return str_contains($message, 'already cancelled')
            || str_contains($message, 'subscription is not active')
            || str_contains($message, 'cannot be cancelled in current state')
            || str_contains($message, 'is completed')
            || str_contains($message, 'is expired');
    }

    private function isSubscriptionMissingError(BadRequestError $exception): bool
    {
        $message = strtolower($exception->getMessage());

        return str_contains($message, 'does not exist')
            || str_contains($message, 'not found')
            || str_contains($message, 'invalid subscription id');
    }
}
