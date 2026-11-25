<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class LoginOtpMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public string $otpCode) {}

    public function build()
    {
        $template = \App\Models\EmailTemplate::where('key', 'login_otp')->where('is_active', true)->first();
        if ($template) {
            $data = ['otpCode' => $this->otpCode];
            try {
                return $this
                    ->subject($template->renderSubject($data))
                    ->html($template->render($data));
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::warning("Failed rendering dynamic login_otp template: " . $e->getMessage());
            }
        }

        return $this
            ->subject("Your Boomerr login code: " . $this->otpCode)
            ->view("emails.login-otp")
            ->with([
                "otpCode" => $this->otpCode,
            ]);
    }
}
