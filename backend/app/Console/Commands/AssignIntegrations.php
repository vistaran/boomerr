<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use App\Models\Integration;
use App\Models\Workspace;
use App\Models\Domain;
use App\Models\DomainIntegration;
use App\Models\WorkspaceIntegration;

class AssignIntegrations extends Command
{
    protected $signature = 'integrations:assign
        {--disable-workspaces : Assign integrations to workspaces as disabled}
        {--disable-domains : Assign integrations to domains as disabled}';

    protected $description = 'Assign all integrations to all existing workspaces and domains';

    public function handle(): int
    {
        $integrations = Integration::all();
        $workspaces   = Workspace::all();
        $domains      = Domain::all();

        if ($integrations->isEmpty()) {
            $this->error('No integrations found.');
            return self::FAILURE;
        }

        if ($workspaces->isEmpty() && $domains->isEmpty()) {
            $this->error('No workspaces or domains found.');
            return self::FAILURE;
        }

        $workspaceEnabled = ! $this->option('disable-workspaces');
        $domainEnabled    = ! $this->option('disable-domains');

        DB::transaction(function () use (
            $integrations,
            $workspaces,
            $domains,
            $workspaceEnabled,
            $domainEnabled
        ) {
            foreach ($integrations as $integration) {

                // Assign to workspaces
                foreach ($workspaces as $workspace) {
                    WorkspaceIntegration::updateOrCreate(
                        [
                            'workspace_id'   => $workspace->id,
                            'integration_id' => $integration->id,
                        ],
                        [
                            'enabled'     => $workspaceEnabled,
                            'created_at'  => now(),
                            'updated_at'  => now(),
                        ]
                    );
                }

                // Assign to domains
                foreach ($domains as $domain) {
                    DomainIntegration::updateOrCreate(
                        [
                            'domain_id'      => $domain->id,
                            'integration_id' => $integration->id,
                        ],
                        [
                            'enabled'     => $domainEnabled,
                            'created_at'  => now(),
                            'updated_at'  => now(),
                        ]
                    );
                }
            }
        });

        $this->info('✅ Integrations assigned successfully.');
        $this->line(sprintf(
            '- Workspaces: %s',
            $workspaceEnabled ? 'enabled' : 'disabled'
        ));
        $this->line(sprintf(
            '- Domains: %s',
            $domainEnabled ? 'enabled' : 'disabled'
        ));

        return self::SUCCESS;
    }
}
