<?php

namespace App\Services\Payments\Contracts;

use Illuminate\Http\Request;

interface PaymentGateway
{
    public function createSubscription(array $data): array;

    public function cancelSubscription(string $subscriptionId): bool;

    public function cancelSubscriptionAtCycleEnd(string $subscriptionId): bool;

    public function resumeSubscription(string $subscriptionId): array;

    public function getSubscriptionDetails(string $subscriptionId): array;

    public function verifyWebhook(string $payload, ?string $signature): bool;

    public function extractSignature(Request $request): ?string;

    public function parseEvent(array $payload): array;

    public function getPublicKey(): string;
}
