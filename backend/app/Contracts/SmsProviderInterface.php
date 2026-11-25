<?php

namespace App\Contracts;

interface SmsProviderInterface
{
    /**
     * Send an SMS message.
     *
     * @param  string  $to       Recipient phone in E.164 format
     * @param  string  $message  Message text
     * @return string  Provider message ID / SID
     */
    public function send(string $to, string $message, array $variables = []): string;
}
