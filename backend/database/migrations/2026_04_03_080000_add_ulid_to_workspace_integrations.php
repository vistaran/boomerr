<?php

use App\Models\WorkspaceIntegration;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('workspace_integrations', function (Blueprint $table) {
            $table->ulid('ulid')->nullable()->after('id');
        });

        WorkspaceIntegration::whereNull('ulid')
            ->orWhere('ulid', '')
            ->chunkById(500, function ($records) {
                foreach ($records as $record) {
                    $record->update([
                        'ulid' => strtolower((string) Str::ulid()),
                    ]);
                }
            });

        Schema::table('workspace_integrations', function (Blueprint $table) {
            $table->unique('ulid');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('workspace_integrations', function (Blueprint $table) {
            $table->dropUnique(['ulid']);
            $table->dropColumn('ulid');
        });
    }
};
