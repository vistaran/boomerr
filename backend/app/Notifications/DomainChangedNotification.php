<?php

namespace App\Notifications;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class DomainChangedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    /** @param array<int, array{field:string,before:mixed,after:mixed}> $changes */
    public function __construct(
        public array $domainData,
        public string $action,
        public array $changes = [],
        public ?User $actor = null,
    ) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database', 'broadcast'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $title = $this->mailSubject();

        $data = [
            'title' => $title,
            'summary' => $this->summaryLine(),
            'domain' => $this->domainData,
            'environment' => ucfirst(($this->domainData['environment'] ?? 'production')),
            'url' => $this->domainData['url'] ?? '#',
            'actor' => $this->actorDisplay(),
            'changes' => $this->changes,
            'timestamp' => now()->toDateTimeString(),
            'action' => $this->action,
        ];

        $template = \App\Models\EmailTemplate::where('key', 'domain_changed')->where('is_active', true)->first();
        if ($template) {
            try {
                return (new MailMessage)
                    ->subject($template->renderSubject($data))
                    ->view(['html' => new \Illuminate\Support\HtmlString($template->render($data))]);
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::warning("Dynamic domain_changed render failed: " . $e->getMessage());
            }
        }

        return (new MailMessage)
            ->subject($title)
            ->view('emails.domain-changed', $data);
    }

    public function toArray(object $notifiable): array
    {
        return [
            'action' => $this->action,
            'domain' => $this->domainData,
            'changes' => $this->changes,
            'workspace_id' => $this->domainData['workspace_id'] ?? null,
            'actor' => $this->actor ? [
                'id' => $this->actor->id,
                'name' => $this->actor->name,
                'email' => $this->actor->email,
            ] : null,
        ];
    }

    private function mailSubject(): string
    {
        return match ($this->action) {
            'created' => "Domain added: " . ($this->domainData['name'] ?? 'Domain'),
            'updated' => "Domain updated: " . ($this->domainData['name'] ?? 'Domain'),
            'deleted' => "Domain deleted: " . ($this->domainData['name'] ?? 'Domain'),
            default   => "Domain changed: " . ($this->domainData['name'] ?? 'Domain'),
        };
    }

    private function summaryLine(): string
    {
        return match ($this->action) {
            'created' => "A new domain was added: " . ($this->domainData['name'] ?? 'Domain') . ".",
            'updated' => "A domain was updated: " . ($this->domainData['name'] ?? 'Domain') . ".",
            'deleted' => "A domain was deleted: " . ($this->domainData['name'] ?? 'Domain') . ".",
            default   => "A domain changed: " . ($this->domainData['name'] ?? 'Domain') . ".",
        };
    }

    private function actorDisplay(): string
    {
        $actor = $this->actor;
        if (! $actor) {
            return 'System';
        }

        return $actor->email
            ? sprintf('%s (%s)', $actor->name ?? 'User', $actor->email)
            : ($actor->name ?? 'User');
    }

    public static function stringify($value): string
    {
        if ($value === null || $value === '') {
            return '(blank)';
        }

        if (is_bool($value)) {
            return $value ? 'Yes' : 'No';
        }

        if (is_scalar($value)) {
            return (string) $value;
        }

        return json_encode($value);
    }
}
