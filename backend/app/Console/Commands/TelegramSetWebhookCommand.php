<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

class TelegramSetWebhookCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'telegram:webhook 
                            {action=set : The action to perform (set, get, delete)}
                            {--url= : The webhook URL (for set action)}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Manage the Telegram bot webhook (set, get, delete)';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $botToken = config('services.telegram.bot_token');
        
        if (!$botToken) {
            $this->error('TELEGRAM_BOT_TOKEN is not set in the .env file.');
            return Command::FAILURE;
        }

        $action = $this->argument('action');

        return match ($action) {
            'set' => $this->setWebhook($botToken),
            'get' => $this->getWebhook($botToken),
            'delete' => $this->deleteWebhook($botToken),
            default => $this->invalidAction($action),
        };
    }

    protected function setWebhook(string $botToken): int
    {
        $url = $this->option('url') ?: config('app.url') . '/api/webhooks/telegram';
        $secretToken = config('services.telegram.webhook_secret');

        $this->info("Setting webhook to: {$url}");

        // Validate the secret token based on Telegram's requirements
        // Telegram API requires secret_token to be 1-256 characters long
        // Only A-Z, a-z, 0-9, _, and - are allowed
        if ($secretToken) {
            if (!preg_match('/^[a-zA-Z0-9_-]{1,256}$/', $secretToken)) {
                $this->error('Error: TELEGRAM_WEBHOOK_SECRET contains invalid characters or has invalid length.');
                $this->error('Telegram only allows A-Z, a-z, 0-9, _, and -');
                $this->error("Current secret: {$secretToken}");
                return Command::FAILURE;
            }
        }

        $payload = [
            'url' => $url,
            'drop_pending_updates' => false,
        ];

        if ($secretToken) {
            $payload['secret_token'] = $secretToken;
        }

        $response = Http::post("https://api.telegram.org/bot{$botToken}/setWebhook", $payload);

        if ($response->successful() && $response->json('ok') === true) {
            $this->info('✅ Webhook successfully set!');
            
            // Set commands
            $commandsResponse = Http::post("https://api.telegram.org/bot{$botToken}/setMyCommands", [
                'commands' => [
                    [
                        'command' => 'settings',
                        'description' => 'Manage your alert preferences'
                    ]
                ]
            ]);

            if ($commandsResponse->successful() && $commandsResponse->json('ok') === true) {
                $this->info('✅ Bot commands successfully registered!');
            } else {
                $this->error('❌ Failed to register bot commands.');
            }

            return Command::SUCCESS;
        }

        $this->error('❌ Failed to set webhook.');
        $this->line($response->body());
        
        return Command::FAILURE;
    }

    protected function getWebhook(string $botToken): int
    {
        $this->info('Fetching webhook info...');

        $response = Http::get("https://api.telegram.org/bot{$botToken}/getWebhookInfo");

        if ($response->successful() && $response->json('ok') === true) {
            $this->line(json_encode($response->json('result'), JSON_PRETTY_PRINT));
            return Command::SUCCESS;
        }

        $this->error('❌ Failed to get webhook info.');
        $this->line($response->body());
        
        return Command::FAILURE;
    }

    protected function deleteWebhook(string $botToken): int
    {
        $this->info('Deleting webhook...');

        $response = Http::post("https://api.telegram.org/bot{$botToken}/deleteWebhook", [
            'drop_pending_updates' => false,
        ]);

        if ($response->successful() && $response->json('ok') === true) {
            $this->info('✅ Webhook successfully deleted!');
            return Command::SUCCESS;
        }

        $this->error('❌ Failed to delete webhook.');
        $this->line($response->body());
        
        return Command::FAILURE;
    }

    protected function invalidAction(string $action): int
    {
        $this->error("Invalid action: {$action}. Use 'set', 'get', or 'delete'.");
        return Command::FAILURE;
    }
}
