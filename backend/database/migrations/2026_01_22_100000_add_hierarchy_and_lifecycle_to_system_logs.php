<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('system_logs', function (Blueprint $table) {
            // Hierarchy support
            $table->unsignedBigInteger('parent_id')->nullable()->after('id');
            $table->string('log_type', 32)->default('action')->after('parent_id');

            // Integration identification
            $table->string('integration_key', 64)->nullable()->after('integration_id');

            // Lifecycle timestamps
            $table->timestamp('triggered_at')->nullable()->after('occurred_at');
            $table->timestamp('completed_at')->nullable()->after('triggered_at');

            // Execution tracking
            $table->string('execution_status', 32)->default('success')->after('status');
            $table->string('trigger_source', 128)->nullable()->after('execution_status');

            // Integration-specific metadata
            $table->json('integration_metadata')->nullable()->after('payload');

            // Foreign key for hierarchy
            $table->foreign('parent_id')
                ->references('id')
                ->on('system_logs')
                ->nullOnDelete();

            // Indexes for efficient querying
            $table->index(['parent_id', 'occurred_at'], 'system_logs_parent_time_idx');
            $table->index(['log_type', 'occurred_at'], 'system_logs_type_time_idx');
            $table->index(['integration_key', 'occurred_at'], 'system_logs_integration_key_time_idx');
            $table->index('execution_status', 'system_logs_exec_status_idx');
        });

        // Backfill existing records
        DB::statement("
            UPDATE system_logs SET
                log_type = 'action',
                triggered_at = occurred_at,
                completed_at = occurred_at,
                execution_status = CASE
                    WHEN status = 'success' THEN 'success'
                    WHEN status = 'failure' THEN 'failure'
                    WHEN status = 'warning' THEN 'success'
                    WHEN status = 'skipped' THEN 'skipped'
                    ELSE 'success'
                END
            WHERE log_type = 'action' OR log_type IS NULL
        ");
    }

    public function down(): void
    {
        Schema::table('system_logs', function (Blueprint $table) {
            $table->dropForeign(['parent_id']);
            $table->dropIndex('system_logs_parent_time_idx');
            $table->dropIndex('system_logs_type_time_idx');
            $table->dropIndex('system_logs_integration_key_time_idx');
            $table->dropIndex('system_logs_exec_status_idx');

            $table->dropColumn([
                'parent_id',
                'log_type',
                'integration_key',
                'triggered_at',
                'completed_at',
                'execution_status',
                'trigger_source',
                'integration_metadata',
            ]);
        });
    }
};
