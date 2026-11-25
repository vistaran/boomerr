<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        DB::table('user_integrations')
            ->select('workspace_id', 'provider', 'account_id', DB::raw('MIN(id) as keep_id'), DB::raw('COUNT(*) as duplicates'))
            ->whereNotNull('account_id')
            ->groupBy('workspace_id', 'provider', 'account_id')
            ->having('duplicates', '>', 1)
            ->get()
            ->each(function ($row) {
                DB::table('user_integrations')
                    ->where('workspace_id', $row->workspace_id)
                    ->where('provider', $row->provider)
                    ->where('account_id', $row->account_id)
                    ->where('id', '<>', $row->keep_id)
                    ->delete();
            });

        Schema::table('user_integrations', function (Blueprint $table) {
            $table->unique(
                ['workspace_id', 'provider', 'account_id'],
                'user_integrations_workspace_provider_account_unique'
            );
        });
    }

    public function down(): void
    {
        Schema::table('user_integrations', function (Blueprint $table) {
            $table->dropUnique('user_integrations_workspace_provider_account_unique');
        });
    }
};
