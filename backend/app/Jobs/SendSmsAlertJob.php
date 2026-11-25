<?php

namespace App\Jobs;

use App\Contracts\SmsProviderInterface;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class SendSmsAlertJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $backoff = 30;

    public function __construct(
        public readonly string $phone,
        public readonly string $message,
        public readonly array $variables = [],
        public readonly ?int $workspaceId = null,
        public readonly ?int $domainId = null,
        public readonly ?int $settingId = null,
    ) {
        $this->queue = 'notifications';
    }

    public function handle(SmsProviderInterface $sms): void
    {
        $workspace = null;
        if ($this->workspaceId) {
            $workspaceDisabled = \App\Models\WorkspaceIntegration::whereHas('integration', fn($q) => $q->where('key', 'sms'))
                ->where('workspace_id', $this->workspaceId)
                ->where('enabled', false)
                ->exists();

            if ($workspaceDisabled) {
                Log::info('SMS alert skipped (disabled at workspace level)', ['phone' => $this->phone, 'workspace_id' => $this->workspaceId]);
                return;
            }

            $workspace = \App\Models\Workspace::find($this->workspaceId);
        }

        if ($this->domainId) {
            $domainDisabled = \App\Models\DomainIntegration::whereHas('integration', fn($q) => $q->where('key', 'sms'))
                ->where('domain_id', $this->domainId)
                ->where('enabled', false)
                ->exists();

            if ($domainDisabled) {
                Log::info('SMS alert skipped (disabled at domain level)', ['phone' => $this->phone, 'domain_id' => $this->domainId]);
                return;
            }
        }

        // Atomically reserve credit before sending if billing is enabled
        $smsCreditService = app(\App\Services\SmsCreditService::class);
        $creditReserved = false;

        if (config('billing.enabled', false) && $workspace) {
            $creditReserved = $smsCreditService->reserveCredit($workspace, 1);
            if (!$creditReserved) {
                Log::warning('SMS alert skipped: monthly SMS credit limit reached or SMS disabled', [
                    'phone' => $this->phone,
                    'workspace_id' => $this->workspaceId,
                ]);
                return;
            }
        }

        $startedAt = microtime(true);
        $status = 'failed';
        $durationMs = null;
        $responseBody = null;
        
        try {
            $sid = $sms->send($this->phone, $this->message, $this->variables);
            $status = 'success';
            $durationMs = (int) round((microtime(true) - $startedAt) * 1000);
            $responseBody = 'Message SID: ' . $sid;

            Log::info('SMS alert dispatched', [
                'phone'       => $this->phone,
                'message_sid' => $sid,
                'variables'   => $this->variables,
            ]);
        } catch (\Throwable $e) {
            // Refund reserved credit if provider send fails or throws
            if ($creditReserved && $workspace) {
                $smsCreditService->refundCredit($workspace, 1);
            }

            $durationMs = (int) round((microtime(true) - $startedAt) * 1000);
            $responseBody = $e->getMessage();
            
            Log::error('SMS alert job failed', [
                'phone' => $this->phone,
                'error' => $e->getMessage(),
                'variables' => $this->variables,
            ]);

            throw $e;
        } finally {
            try {
                if ($this->settingId) {
                    $setting = \App\Models\SmsNotificationSetting::find($this->settingId);
                    if ($setting) {
                        $setting->deliveries()->create([
                            'event_name' => 'SMS Alert',
                            'http_status' => $status === 'success' ? 200 : 500,
                            'status' => $status,
                            'attempt' => $this->attempts(),
                            'request_payload' => [
                                'phone' => $this->phone,
                                'message' => $this->message,
                                'variables' => $this->variables,
                            ],
                            'response_headers' => null,
                            'response_body' => $responseBody,
                            'duration_ms' => $durationMs,
                        ]);
                    }
                }
            } catch (\Throwable $deliveryLogEx) {
                Log::warning('Failed to record SMS delivery log: ' . $deliveryLogEx->getMessage(), [
                    'setting_id' => $this->settingId,
                ]);
            }
        }
    }
}
