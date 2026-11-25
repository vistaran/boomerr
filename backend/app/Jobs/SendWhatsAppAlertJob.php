<?php

namespace App\Jobs;

use App\Contracts\WhatsAppProviderInterface;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class SendWhatsAppAlertJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $backoff = 30;

    /**
     * @param  string       $phone             Recipient phone in E.164 format
     * @param  string       $message           Plain-text fallback message (used when no template)
     * @param  string|null  $templateName      Meta template name (e.g. boomerr_domain_status_alert)
     * @param  array        $templateParams    Ordered body parameters for the template
     * @param  string       $templateLanguage  Template language code
     * @param  array        $headerParams      Ordered header parameters for the template
     */
    public function __construct(
        public readonly string $phone,
        public readonly string $message,
        public readonly ?string $templateName = null,
        public readonly array $templateParams = [],
        public readonly string $templateLanguage = 'en',
        public readonly array $headerParams = [],
        public readonly ?int $workspaceId = null,
        public readonly ?int $domainId = null,
        public readonly ?int $settingId = null,
    ) {
        $this->queue = 'notifications';
    }

    public function handle(WhatsAppProviderInterface $whatsapp): void
    {
        if ($this->workspaceId) {
            $workspaceDisabled = \App\Models\WorkspaceIntegration::whereHas('integration', fn($q) => $q->where('key', 'whatsapp'))
                ->where('workspace_id', $this->workspaceId)
                ->where('enabled', false)
                ->exists();

            if ($workspaceDisabled) {
                Log::info('WhatsApp alert skipped (disabled at workspace level)', ['phone' => $this->phone, 'workspace_id' => $this->workspaceId]);
                return;
            }
        }

        if ($this->domainId) {
            $domainDisabled = \App\Models\DomainIntegration::whereHas('integration', fn($q) => $q->where('key', 'whatsapp'))
                ->where('domain_id', $this->domainId)
                ->where('enabled', false)
                ->exists();

            if ($domainDisabled) {
                Log::info('WhatsApp alert skipped (disabled at domain level)', ['phone' => $this->phone, 'domain_id' => $this->domainId]);
                return;
            }
            // Atomically reserve credit before sending if billing is enabled
            $workspace = $this->workspaceId ? \App\Models\Workspace::find($this->workspaceId) : null;
            $waCreditService = app(\App\Services\WhatsAppCreditService::class);
            $creditReserved = false;

            if (config('billing.enabled', false) && $workspace) {
                $creditReserved = $waCreditService->reserveCredit($workspace, 1);
                if (!$creditReserved) {
                    Log::warning('WhatsApp alert skipped: monthly WhatsApp credit limit reached or WhatsApp disabled', [
                        'phone' => $this->phone,
                        'workspace_id' => $this->workspaceId,
                    ]);
                    return;
                }
            }
        }

        $startedAt = microtime(true);
        $status = 'failed';
        $durationMs = null;
        $responseBody = null;
        $usedTemplate = null;

        try {
            if ($this->templateName !== null && $this->templateName !== '') {
                $primaryTemplate = $this->templateName;
                $usedTemplate = $primaryTemplate;

                try {
                    $sid = $whatsapp->sendTemplate(
                        $this->phone,
                        $primaryTemplate,
                        $this->templateParams,
                        $this->templateLanguage,
                        $this->headerParams,
                    );
                } catch (\Throwable $templateError) {
                    $errorMessage = (string) $templateError->getMessage();

                    $isTemplateNotFound = str_contains($errorMessage, '132001')
                        || str_contains(strtolower($errorMessage), 'template name does not exist');

                    if (!$isTemplateNotFound) {
                        throw $templateError;
                    }

                    $fallbackTemplates = (array) config("services.whatsapp.template_fallbacks.{$primaryTemplate}", []);

                    if (str_contains($primaryTemplate, 'domai_')) {
                        $autoCandidate = str_replace('domai_', 'domain_', $primaryTemplate);
                        if (!in_array($autoCandidate, $fallbackTemplates, true)) {
                            $fallbackTemplates[] = $autoCandidate;
                        }
                    }

                    $sid = null;
                    $lastException = $templateError;

                    foreach ($fallbackTemplates as $fallbackTemplate) {
                        if (!is_string($fallbackTemplate) || trim($fallbackTemplate) === '') {
                            continue;
                        }

                        try {
                            Log::warning('WhatsApp template fallback retry', [
                                'phone' => $this->phone,
                                'from_template' => $primaryTemplate,
                                'fallback_template' => $fallbackTemplate,
                                'reason' => $errorMessage,
                            ]);

                            $sid = $whatsapp->sendTemplate(
                                $this->phone,
                                $fallbackTemplate,
                                $this->templateParams,
                                $this->templateLanguage,
                                $this->headerParams,
                            );

                            $usedTemplate = $fallbackTemplate;

                            Log::info('WhatsApp template fallback succeeded', [
                                'phone' => $this->phone,
                                'from_template' => $primaryTemplate,
                                'used_template' => $fallbackTemplate,
                            ]);

                            break;
                        } catch (\Throwable $fallbackError) {
                            $lastException = $fallbackError;
                        }
                    }

                    if ($sid === null) {
                        throw $lastException;
                    }
                }

                $status = 'success';
                $durationMs = (int) round((microtime(true) - $startedAt) * 1000);
                $responseBody = 'Message SID: ' . $sid;

                Log::info('WhatsApp template alert dispatched', [
                    'phone' => $this->phone,
                    'template' => $this->templateName,
                    'message_sid' => $sid,
                ]);
            } else {
                $sid = $whatsapp->send($this->phone, $this->message);
                $status = 'success';
                $durationMs = (int) round((microtime(true) - $startedAt) * 1000);
                $responseBody = 'Message SID: ' . $sid;

                Log::info('WhatsApp alert dispatched', [
                    'phone' => $this->phone,
                    'message_sid' => $sid,
                ]);
            }
        } catch (\Throwable $e) {
            // Refund reserved credit if provider send fails or throws
            if ($creditReserved && $workspace) {
                $waCreditService->refundCredit($workspace, 1);
            }

            $durationMs = (int) round((microtime(true) - $startedAt) * 1000);
            $responseBody = $e->getMessage();

            Log::error('WhatsApp alert job failed', [
                'phone' => $this->phone,
                'template' => $this->templateName,
                'error' => $e->getMessage(),
            ]);

            throw $e;
        } finally {
            if ($this->settingId) {
                $setting = \App\Models\WhatsappNotificationSetting::find($this->settingId);
                if ($setting) {
                    $setting->deliveries()->create([
                        'event_name' => 'WhatsApp Alert',
                        'http_status' => $status === 'success' ? 200 : 500,
                        'status' => $status,
                        'attempt' => $this->attempts(),
                        'request_payload' => [
                            'phone' => $this->phone,
                            'message' => $this->message,
                            'template' => $usedTemplate,
                            'template_params' => $this->templateParams,
                            'header_params' => $this->headerParams,
                        ],
                        'response_headers' => null,
                        'response_body' => $responseBody,
                        'duration_ms' => $durationMs,
                    ]);
                }
            }
        }
    }
}
