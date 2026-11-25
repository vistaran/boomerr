<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use App\Models\Integration;
use Illuminate\Support\Facades\Log;

class AssignIntegrationPosition extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'integrations:assign-positions';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Assign integration positions from integrations table into workspace_integrations and domain_integrations pivot tables';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {


        $integrations = Integration::all(['id', 'position']);
        if ($integrations->isEmpty()) {
            $this->error('No integrations found.');
            return self::FAILURE;
        }

        $updatedWorkspace = 0;
        $updatedDomain = 0;

        DB::transaction(function () use ($integrations, &$updatedWorkspace, &$updatedDomain) {
            foreach ($integrations as $integration) {
                // Always update position for all matching rows
                $affected = DB::table('workspace_integrations')
                    ->where('integration_id', $integration->id)
                    ->update([
                        'position'  => $integration->position,
                        'updated_at' => now(),
                    ]);
                $updatedWorkspace += $affected;

                $affected = DB::table('domain_integrations')
                    ->where('integration_id', $integration->id)
                    ->update([
                        'position'  => $integration->position,
                        'updated_at' => now(),
                    ]);
                $updatedDomain += $affected;
            }
        });

        $this->info('✅ Integration positions assigned.');
        $this->line(sprintf('Workspace rows updated: %d', $updatedWorkspace));
        $this->line(sprintf('Domain rows updated: %d', $updatedDomain));


        return self::SUCCESS;
    }
}
