<?php

namespace App\Services;

use App\Models\Domain;
use Aws\Lambda\LambdaClient;
use Illuminate\Support\Facades\Log;
use Throwable;

class MonitoringDispatcherService
{
    /**
     * Cache of lambda clients keyed by AWS region.
     * @var array<string, LambdaClient>
     */
    protected array $lambdaClients = [];

    /**
     * Cache of active monitoring regions.
     * @var \Illuminate\Database\Eloquent\Collection|null
     */
    protected $activeRegions = null;

    public function __construct()
    {
    }

    /**
     * Get or initialize a LambdaClient for a specific AWS region.
     */
    protected function getLambdaClient(string $region): LambdaClient
    {
        if (!isset($this->lambdaClients[$region])) {
            $this->lambdaClients[$region] = new LambdaClient([
                'version' => 'latest',
                'region' => $region,
                'credentials' => [
                    'key' => config('services.ses.key', env('AWS_ACCESS_KEY_ID')),
                    'secret' => config('services.ses.secret', env('AWS_SECRET_ACCESS_KEY')),
                ],
            ]);
        }

        return $this->lambdaClients[$region];
    }

    /**
     * Get all active monitoring regions.
     */
    protected function getActiveRegions()
    {
        if ($this->activeRegions === null) {
            $this->activeRegions = \App\Models\MonitoringRegion::where('is_active', true)->get();
        }

        return $this->activeRegions;
    }

    /**
     * Dispatch a website monitoring job to AWS Lambda asynchronously across all active regions.
     *
     * @param Domain $domain
     * @return void
     */
    public function dispatchToLambda(Domain $domain): void
    {
        $regions = $this->getActiveRegions();

        if ($regions->isEmpty()) {
            Log::warning('No active monitoring regions found. Cannot dispatch lambda monitoring job.', [
                'domain_id' => $domain->id,
                'url' => $domain->url,
            ]);
            return;
        }

        // Domain multi-region status is already verified by the caller (RunLambdaUptimeChecks)
        Log::info("Dispatching Lambda checks across all active regions", ['domain_id' => $domain->id]);

        $promises = [];

        foreach ($regions as $region) {
            try {
                $payload = json_encode([
                    'website_id' => $domain->id,
                    'url' => $domain->url,
                ]);

                Log::info("Invoking Lambda", [
                    'domain_id' => $domain->id, 
                    'aws_region' => $region->aws_region, 
                    'function_name' => $region->lambda_function_name,
                    'payload' => $payload
                ]);

                $client = $this->getLambdaClient($region->aws_region);
                $promises[] = $client->invokeAsync([
                    'FunctionName' => $region->lambda_function_name,
                    'InvocationType' => 'Event', // Asynchronous invocation
                    'Payload' => $payload,
                ]);
            } catch (Throwable $e) {
                Log::error("Failed to dispatch monitoring job to Lambda in region {$region->aws_region}", [
                    'domain_id' => $domain->id,
                    'url' => $domain->url,
                    'lambda_function' => $region->lambda_function_name,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        try {
            \GuzzleHttp\Promise\Utils::settle($promises)->wait();
        } catch (Throwable $e) {
            Log::error("Failed waiting for async Lambda dispatches (single domain)", ['domain_id' => $domain->id, 'error' => $e->getMessage()]);
        }
    }

    /**
     * Dispatch a batch of website monitoring jobs to AWS Lambda asynchronously across all active regions.
     *
     * @param \Illuminate\Support\Collection $domainsChunk
     * @return void
     */
    public function dispatchBatchToLambda(\Illuminate\Support\Collection $domainsChunk): void
    {
        $regions = $this->getActiveRegions();

        if ($regions->isEmpty()) {
            Log::warning('No active monitoring regions found. Cannot dispatch batch lambda monitoring job.');
            return;
        }

        Log::info("Dispatching Lambda batch checks across all active regions", ['batch_size' => $domainsChunk->count()]);

        $batchPayloadData = $domainsChunk->map(function ($domain) {
            return [
                'website_id' => $domain->id,
                'url' => $domain->url,
            ];
        })->values()->toArray();

        $promises = [];

        foreach ($regions as $region) {
            try {
                $payload = json_encode([
                    'batch' => $batchPayloadData,
                ]);

                Log::info("Invoking Lambda Batch", [
                    'aws_region' => $region->aws_region, 
                    'function_name' => $region->lambda_function_name,
                    'batch_size' => count($batchPayloadData)
                ]);

                $client = $this->getLambdaClient($region->aws_region);
                $promises[] = $client->invokeAsync([
                    'FunctionName' => $region->lambda_function_name,
                    'InvocationType' => 'Event', // Asynchronous invocation
                    'Payload' => $payload,
                ]);
            } catch (Throwable $e) {
                Log::error("Failed to dispatch monitoring batch to Lambda in region {$region->aws_region}", [
                    'lambda_function' => $region->lambda_function_name,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        try {
            \GuzzleHttp\Promise\Utils::settle($promises)->wait();
        } catch (Throwable $e) {
            Log::error("Failed waiting for async Lambda batch dispatches", ['error' => $e->getMessage()]);
        }
    }
}
