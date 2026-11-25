<?php

namespace App\Notifications;

use App\Models\TeamInvitation;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;

class TeamInvitationNotification extends Notification implements ShouldQueue
{
    use Queueable;

    protected $invitation;

    /**
     * Create a new notification instance.
     *
     * @param TeamInvitation $invitation
     */
    public function __construct(TeamInvitation $invitation)
    {
        $this->invitation = $invitation;
    }

    /**
     * Get the notification's delivery channels.
     *
     * @param mixed $notifiable
     * @return array
     */
    public function via($notifiable)
    {
        return ['mail'];
    }

    /**
     * Get the mail representation of the notification.
     *
     * @param mixed $notifiable
     * @return \Illuminate\Notifications\Messages\MailMessage
     */
    public function toMail($notifiable)
    {
        // Prefer configured frontend URL; fallback to APP_URL if not set
        $frontendBase = config('app.frontend_url') ?: config('app.url');
        // Normalize trailing slash
        $frontendBase = rtrim((string) $frontendBase, '/');
        $link = $frontendBase . "/accept-invitation/{$this->invitation->token}";

        $data = [
            'invitation' => $this->invitation,
            'acceptUrl' => $link,
            'inviteUrl' => $link,
            'workspaceName' => $this->invitation->workspace->name ?? $this->invitation->company->name ?? 'Boomerr Workspace',
            'inviterName' => $this->invitation->inviter->name ?? 'A team administrator',
            'unsubscribeUrl' => $frontendBase . '/email-preferences',
        ];

        $template = \App\Models\EmailTemplate::where('key', 'team_invitation')->where('is_active', true)->first();
        if ($template) {
            try {
                return (new MailMessage)
                    ->subject($template->renderSubject($data))
                    ->view(['html' => new \Illuminate\Support\HtmlString($template->render($data))]);
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::warning("Dynamic team_invitation render failed: " . $e->getMessage());
            }
        }

        return (new MailMessage)
            ->subject('Team Invitation')
            ->view('emails.team_invitation', [
                'invitation' => $this->invitation,
            ]);
    }
}
