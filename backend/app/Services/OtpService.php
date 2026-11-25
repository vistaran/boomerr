<?php

namespace App\Services;

use App\Contracts\SmsProviderInterface;
use App\Contracts\WhatsAppProviderInterface;
use App\Models\OtpVerification;
use Illuminate\Support\Facades\Log;

class OtpService
{
    public function __construct(
        private readonly SmsProviderInterface $smsProvider,
        private readonly WhatsAppProviderInterface $whatsAppProvider,
    ) {
    }

    /**
     * Generate a 6-digit OTP, persist it, and send it via the given channel.
     *
     * @param  int     $userId
     * @param  int     $workspaceId
     * @param  string  $channel      'sms' or 'whatsapp'
     * @param  string  $phoneNumber  E.164 phone number
     * @param  array   $payload      The pending configuration data to store after verification
     * @return OtpVerification
     */
    public function sendOtp(
        int $userId,
        int $workspaceId,
        string $channel,
        string $phoneNumber,
        array $payload,
    ): OtpVerification {
        // Invalidate any previous un-verified OTPs for same user + channel + phone
        OtpVerification::where('user_id', $userId)
            ->where('channel', $channel)
            ->where('phone_number', $phoneNumber)
            ->whereNull('verified_at')
            ->delete();

        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        $otp = OtpVerification::create([
            'user_id' => $userId,
            'workspace_id' => $workspaceId,
            'channel' => $channel,
            'phone_number' => $phoneNumber,
            'otp_code' => $code,
            'payload' => $payload,
            'expires_at' => now()->addMinutes(10),
        ]);

        $appName = config('app.name');
        $message = "[{$appName}] Your verification code is: {$code}. It expires in 10 minutes.";
        $otpTemplate = (string) config('services.whatsapp.templates.otp', 'otp_verification');
        $templateLanguage = (string) config('services.whatsapp.template_language', 'En');

        try {
            if ($channel === 'sms') {
                $this->smsProvider->send($phoneNumber, $message, ['otp' => $code]);
            } else {
                // Use otp_verification template: "{{1}} is your verification code. ..."
                $this->whatsAppProvider->sendTemplate(
                    $phoneNumber,
                    $otpTemplate,
                    [$code],
                    $templateLanguage,
                    [],
                    [$code],
                );
            }
        } catch (\Throwable $e) {
            Log::error('Failed to send OTP', [
                'channel' => $channel,
                'phone' => $phoneNumber,
                'error' => $e->getMessage(),
            ]);
            // Delete the OTP record if we couldn't deliver
            $otp->delete();
            throw $e;
        }

        return $otp;
    }

    /**
     * Verify an OTP code. Returns the OtpVerification if valid, null otherwise.
     */
    public function verify(int $otpId, string $code): ?OtpVerification
    {
        $otp = OtpVerification::find($otpId);

        if (!$otp) {
            return null;
        }

        if (!$otp->isValid()) {
            return null;
        }

        if ($otp->otp_code !== $code) {
            return null;
        }

        $otp->verified_at = \Illuminate\Support\Carbon::now();
        $otp->save();

        return $otp;
    }

    /**
     * Resend OTP for an existing verification record.
     */
    public function resend(int $otpId): ?OtpVerification
    {
        $otp = OtpVerification::find($otpId);

        if (!$otp || $otp->isVerified()) {
            return null;
        }

        // Generate new code and extend expiry
        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $otp->otp_code = $code;
        $otp->expires_at = \Illuminate\Support\Carbon::now()->addMinutes(10);
        $otp->save();

        $appName = config('app.name');
        $message = "[{$appName}] Your verification code is: {$code}. It expires in 10 minutes.";
        $otpTemplate = (string) config('services.whatsapp.templates.otp', 'otp_verification');
        $templateLanguage = (string) config('services.whatsapp.template_language', 'En');

        if ($otp->channel === 'sms') {
            $this->smsProvider->send($otp->phone_number, $message);
        } else {
            // Use otp_verification template: "{{1}} is your verification code. ..."
            $this->whatsAppProvider->sendTemplate(
                $otp->phone_number,
                $otpTemplate,
                [$code],
                $templateLanguage,
                [],
                [$code],
            );
        }

        return $otp;
    }
}
