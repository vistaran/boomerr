<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Facades\File;

class SystemDoctorCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'boomerr:doctor';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Run a self-hosting diagnostic check on Boomerr environment and infrastructure';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->newLine();
        $this->line('<fg=cyan;options=bold>===============================================================</>');
        $this->line('<fg=cyan;options=bold>               BOOMERR SELF-HOSTING DIAGNOSTIC DOCTOR           </>');
        $this->line('<fg=cyan;options=bold>===============================================================</>');
        $this->newLine();

        $checks = [];
        $hasError = false;

        // 1. Core Environment
        $this->comment('Checking Application Environment...');
        $appKey = config('app.key');
        if (!empty($appKey)) {
            $checks[] = ['Core', 'APP_KEY', 'OK', 'Application key configured'];
        } else {
            $checks[] = ['Core', 'APP_KEY', 'FAIL', 'Missing APP_KEY. Generate with `php artisan key:generate`'];
            $hasError = true;
        }

        $appUrl = config('app.url');
        $checks[] = ['Core', 'APP_URL', 'OK', $appUrl ?: 'http://localhost:8080'];

        $billingEnabled = config('billing.enabled', false);
        if (!$billingEnabled) {
            $checks[] = ['Core', 'Edition', 'OK', 'Community Edition (Unlimited self-hosted mode)'];
        } else {
            $checks[] = ['Core', 'Edition', 'WARN', 'Commercial billing enabled (ENABLE_BILLING=true)'];
        }

        // 2. PHP Environment & Extensions
        $this->comment('Checking PHP Environment & Extensions...');
        $requiredExtensions = ['pdo', 'pdo_mysql', 'mbstring', 'openssl', 'curl', 'sockets', 'bcmath'];
        $missingExtensions = [];
        foreach ($requiredExtensions as $ext) {
            if (!extension_loaded($ext)) {
                $missingExtensions[] = $ext;
            }
        }
        if (empty($missingExtensions)) {
            $checks[] = ['PHP', 'Extensions', 'OK', 'All core extensions loaded (' . PHP_VERSION . ')'];
        } else {
            $checks[] = ['PHP', 'Extensions', 'FAIL', 'Missing extensions: ' . implode(', ', $missingExtensions)];
            $hasError = true;
        }

        // 3. Database Connectivity
        $this->comment('Checking Database Connectivity...');
        try {
            $pdo = DB::connection()->getPdo();
            $driver = DB::connection()->getDriverName();
            $version = $pdo->getAttribute(\PDO::ATTR_SERVER_VERSION);
            $tableCount = count(DB::select('SHOW TABLES'));
            $checks[] = ['Database', 'Connection', 'OK', "Connected to {$driver} (v{$version}) - {$tableCount} tables found"];
        } catch (\Throwable $e) {
            $checks[] = ['Database', 'Connection', 'FAIL', 'Cannot connect: ' . $e->getMessage()];
            $hasError = true;
        }

        // 4. Redis Connectivity
        $this->comment('Checking Redis Connectivity...');
        try {
            if (extension_loaded('redis')) {
                $redisClient = Redis::connection();
                $redisClient->ping();
                $checks[] = ['Cache/Queue', 'Redis', 'OK', 'Redis connected successfully'];
            } else {
                $checks[] = ['Cache/Queue', 'Redis', 'WARN', 'phpredis extension not installed; using array/database cache'];
            }
        } catch (\Throwable $e) {
            $checks[] = ['Cache/Queue', 'Redis', 'WARN', 'Redis connection failed: ' . $e->getMessage()];
        }

        // 5. Storage & Directory Permissions
        $this->comment('Checking Filesystem Permissions...');
        $storagePaths = [
            'storage/app' => storage_path('app'),
            'storage/framework' => storage_path('framework'),
            'storage/logs' => storage_path('logs'),
            'bootstrap/cache' => base_path('bootstrap/cache'),
        ];

        $storageOk = true;
        foreach ($storagePaths as $label => $path) {
            if (!is_dir($path) || !is_writable($path)) {
                $storageOk = false;
                $checks[] = ['Storage', $label, 'FAIL', "Directory '{$path}' is not writable"];
                $hasError = true;
            }
        }
        if ($storageOk) {
            $checks[] = ['Storage', 'Permissions', 'OK', 'Storage and cache directories writable'];
        }

        // Public storage symlink check
        $publicStorage = public_path('storage');
        if (is_link($publicStorage) || is_dir($publicStorage)) {
            $checks[] = ['Storage', 'Public Link', 'OK', 'public/storage link exists'];
        } else {
            $checks[] = ['Storage', 'Public Link', 'WARN', 'public/storage symlink missing. Run `php artisan storage:link`'];
        }

        // 6. WebSockets (Reverb)
        $this->comment('Checking Realtime WebSockets...');
        $reverbKey = config('reverb.apps.apps.0.key', env('REVERB_APP_KEY'));
        if (!empty($reverbKey)) {
            $checks[] = ['WebSockets', 'Reverb', 'OK', "App Key configured: {$reverbKey}"];
        } else {
            $checks[] = ['WebSockets', 'Reverb', 'WARN', 'REVERB_APP_KEY is empty; realtime UI push will be inactive'];
        }

        // 7. Optional Integrations
        $this->comment('Checking Optional Integrations...');
        $aiKey = config('services.ai.key', env('DEEPSEEK_API_KEY', env('AI_API_KEY')));
        $aiBaseUrl = config('services.ai.base_url', env('AI_BASE_URL', 'https://api.deepseek.com/v1'));
        if (!empty($aiKey)) {
            $checks[] = ['Integrations', 'AI Provider', 'OK', "Configured ({$aiBaseUrl})"];
        } else {
            $checks[] = ['Integrations', 'AI Provider', 'INFO', 'Optional: AI diagnostics unconfigured'];
        }

        $hcaptchaKey = config('services.hcaptcha.site_key', env('HCAPTCHA_SITE_KEY'));
        if (!empty($hcaptchaKey)) {
            $checks[] = ['Integrations', 'hCaptcha', 'OK', 'Enabled for public forms'];
        } else {
            $checks[] = ['Integrations', 'hCaptcha', 'INFO', 'Optional: hCaptcha disabled'];
        }

        $mailHost = config('mail.mailers.smtp.host');
        if (!empty($mailHost) && $mailHost !== '127.0.0.1' && $mailHost !== 'localhost') {
            $checks[] = ['Integrations', 'Mail (SMTP)', 'OK', "Configured ({$mailHost})"];
        } else {
            $checks[] = ['Integrations', 'Mail (SMTP)', 'INFO', 'Local or default mailer configured'];
        }

        // Render Summary Table
        $this->newLine();
        $formattedRows = array_map(function ($row) {
            $status = match ($row[2]) {
                'OK' => '<fg=green;options=bold>[ OK ]</>',
                'WARN' => '<fg=yellow;options=bold>[ WARN ]</>',
                'FAIL' => '<fg=red;options=bold>[ FAIL ]</>',
                default => '<fg=blue;options=bold>[ INFO ]</>',
            };
            return [$row[0], $row[1], $status, $row[3]];
        }, $checks);

        $this->table(['Category', 'Component', 'Status', 'Details'], $formattedRows);

        $this->newLine();
        if ($hasError) {
            $this->error('Diagnostic check completed with errors. Please address the [ FAIL ] items above.');
            return self::FAILURE;
        }

        $this->info('Boomerr self-hosting health check passed! System is operational.');
        return self::SUCCESS;
    }
}
