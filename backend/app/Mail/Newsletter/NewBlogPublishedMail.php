<?php

namespace App\Mail\Newsletter;

use App\Models\NewsletterSubscriber;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use App\Mail\Concerns\HasDynamicEmailTemplate;

class NewBlogPublishedMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels, HasDynamicEmailTemplate;

    public NewsletterSubscriber $subscriber;
    public array $blogData;
    public string $unsubscribeUrl;
    public string $blogUrl;

    /**
     * Create a new message instance.
     *
     * @param NewsletterSubscriber $subscriber
     * @param array $blogData
     */
    public function __construct(NewsletterSubscriber $subscriber, array $blogData)
    {
        $this->subscriber = $subscriber;
        $this->blogData = $blogData;

        $baseUrl = rtrim(config('app.website_url', env('WEBSITE_URL', config('app.url', 'http://localhost:8080'))), '/');
        
        $slug = $blogData['slug'] ?? $blogData['seo_slug'] ?? '';
        $this->blogUrl = $baseUrl . '/blog/' . ltrim($slug, '/');
        $this->unsubscribeUrl = $baseUrl . '/blog/unsubscribe?token=' . urlencode($subscriber->token);
    }

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        Log::info("[Newsletter Mailer] Preparing to send blog notification email to {$this->subscriber->email} for blog: '{$this->blogData['title']}'");
        $title = $this->blogData['title'] ?? 'New Engineering Insights';
        $data = [
            'blogTitle' => $title,
            'blogExcerpt' => $this->blogData['excerpt'] ?? '',
            'blogUrl' => $this->blogUrl,
            'blogAuthor' => $this->blogData['author'] ?? 'Boomerr Team',
            'publishedAt' => $this->blogData['published_at'] ?? now()->toFormattedDateString(),
            'unsubscribeUrl' => $this->unsubscribeUrl,
        ];

        return $this->dynamicEnvelope('newsletter_new_blog', 'New on Boomerr: ' . $title, $data);
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        $data = [
            'subscriber' => $this->subscriber,
            'blog' => $this->blogData,
            'blogUrl' => $this->blogUrl,
            'unsubscribeUrl' => $this->unsubscribeUrl,
            'blogTitle' => $this->blogData['title'] ?? 'New Engineering Insights',
            'blogExcerpt' => $this->blogData['excerpt'] ?? '',
            'blogAuthor' => $this->blogData['author'] ?? 'Boomerr Team',
            'publishedAt' => $this->blogData['published_at'] ?? now()->toFormattedDateString(),
        ];

        return $this->dynamicContent('newsletter_new_blog', 'emails.newsletter.new_blog_published', $data);
    }

    /**
     * Get the attachments for the message.
     */
    public function attachments(): array
    {
        return [];
    }
}
