<?php

namespace App\Console\Commands;

use App\Mail\Newsletter\NewBlogPublishedMail;
use App\Models\NewsletterSubscriber;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;

class NotifyBlogSubscribersCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'newsletter:notify-blog
                            {--title= : The title of the blog post}
                            {--slug= : The slug of the blog post}
                            {--excerpt= : A short excerpt or description}
                            {--image= : The featured image URL}
                            {--author= : Author name}
                            {--read-time= : Estimated read time in minutes}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Send an email notification to all active newsletter subscribers about a newly published blog post';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $title = $this->option('title');
        $slug = $this->option('slug');

        if (empty($title)) {
            $title = $this->ask('Enter the blog title');
        }

        if (empty($slug)) {
            $slug = $this->ask('Enter the blog slug');
        }

        if (empty($title) || empty($slug)) {
            $this->error('Both title and slug are required.');
            return Command::FAILURE;
        }

        $blogData = [
            'title' => $title,
            'slug' => $slug,
            'excerpt' => $this->option('excerpt') ?? '',
            'featured_image' => $this->option('image') ?? '',
            'author_name' => $this->option('author') ?? 'The Boomerr Team',
            'avg_read_time' => (int) ($this->option('read-time') ?? 5),
            'published_date' => now()->toIso8601String(),
        ];

        $subscribers = NewsletterSubscriber::active()->get();

        if ($subscribers->isEmpty()) {
            $this->warn('No active subscribers found.');
            return Command::SUCCESS;
        }

        $this->info("Dispatching blog notification to {$subscribers->count()} active subscribers...");

        $bar = $this->output->createProgressBar($subscribers->count());
        $bar->start();

        $sent = 0;
        foreach ($subscribers as $subscriber) {
            try {
                Mail::to($subscriber->email)->queue(new NewBlogPublishedMail($subscriber, $blogData));
                $sent++;
            } catch (\Throwable $e) {
                $this->error("Failed sending to {$subscriber->email}: " . $e->getMessage());
            }
            $bar->advance();
        }

        $bar->finish();
        $this->newLine();
        $this->info("Successfully queued notifications for {$sent} subscribers!");

        return Command::SUCCESS;
    }
}
