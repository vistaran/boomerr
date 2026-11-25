<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OtpVerification extends Model
{
    protected $fillable = [
        'user_id',
        'workspace_id',
        'channel',
        'phone_number',
        'otp_code',
        'payload',
        'expires_at',
        'verified_at',
    ];

    protected $casts = [
        'payload'     => 'array',
        'expires_at'  => 'datetime',
        'verified_at' => 'datetime',
    ];

    /**
     * Check if this OTP has expired.
     */
    public function isExpired(): bool
    {
        return $this->expires_at->isPast();
    }

    /**
     * Check if this OTP has already been verified.
     */
    public function isVerified(): bool
    {
        return $this->verified_at !== null;
    }

    /**
     * Check if this OTP is still valid (not expired and not yet verified).
     */
    public function isValid(): bool
    {
        return ! $this->isExpired() && ! $this->isVerified();
    }
}
