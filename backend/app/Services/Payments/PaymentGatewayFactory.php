<?php

namespace App\Services\Payments;

use App\Services\Payments\Contracts\PaymentGateway;

class PaymentGatewayFactory
{
    public static function make(?string $gatewayName = null): PaymentGateway
    {
        $resolvedGateway = strtolower((string) ($gatewayName ?: config('billing.default_gateway')));

        return match ($resolvedGateway) {
            'razorpay' => app(RazorpayService::class),
            default => throw new \InvalidArgumentException("Invalid gateway [{$resolvedGateway}]"),
        };
    }
}
