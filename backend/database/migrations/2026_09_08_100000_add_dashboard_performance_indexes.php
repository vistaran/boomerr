<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Covering index for 30-day uptime aggregation on domain_status_events
        Schema::table('domain_status_events', function (Blueprint $table) {
            $table->index(['domain_id', 'checked_at', 'status'], 'dse_domain_checked_status_idx');
        });

        // 2. Composite index for fast workspace system logs lookup without filesort
        Schema::table('system_logs', function (Blueprint $table) {
            $table->index(['workspace_id', 'created_at'], 'system_logs_workspace_created_idx');
        });

        // 3. Composite index for fast workspace audit logs lookup without filesort
        Schema::table('audit_logs', function (Blueprint $table) {
            $table->index(['workspace_id', 'occurred_at'], 'audit_logs_workspace_occurred_idx');
        });

        // 4. Composite index for fast open incidents lookup
        Schema::table('incidents', function (Blueprint $table) {
            $table->index(['workspace_id', 'resolved_at'], 'incidents_workspace_resolved_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('domain_status_events', function (Blueprint $table) {
            $table->dropIndex('dse_domain_checked_status_idx');
        });

        Schema::table('system_logs', function (Blueprint $table) {
            $table->dropIndex('system_logs_workspace_created_idx');
        });

        Schema::table('audit_logs', function (Blueprint $table) {
            $table->dropIndex('audit_logs_workspace_occurred_idx');
        });

        Schema::table('incidents', function (Blueprint $table) {
            $table->dropIndex('incidents_workspace_resolved_idx');
        });
    }
};
