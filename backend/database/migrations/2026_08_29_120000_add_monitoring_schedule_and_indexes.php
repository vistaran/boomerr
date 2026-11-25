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
        // 1. Add check_interval and next_check_at to domains table
        Schema::table('domains', function (Blueprint $table) {
            if (!Schema::hasColumn('domains', 'check_interval')) {
                $table->unsignedInteger('check_interval')->default(1)->after('is_active');
            }
            if (!Schema::hasColumn('domains', 'next_check_at')) {
                $table->timestamp('next_check_at')->nullable()->after('last_checked_at');
            }
            $table->index(['is_active', 'next_check_at'], 'domains_active_next_check_idx');
        });

        // 2. Add performance indexes for domain status events aggregation
        Schema::table('domain_status_events', function (Blueprint $table) {
            $table->index(['domain_id', 'region', 'checked_at'], 'dse_domain_region_checked_idx');
            $table->index(['domain_id', 'checked_at'], 'dse_domain_checked_idx');
        });

        // 3. Add performance indexes for incidents lookup
        Schema::table('incidents', function (Blueprint $table) {
            $table->index(['domain_id', 'status', 'started_at'], 'incidents_domain_status_started_idx');
        });

        // 4. Add performance index for notification channels lookup
        Schema::table('notification_channels', function (Blueprint $table) {
            $table->index(['workspace_id', 'domain_id', 'is_active'], 'nc_workspace_domain_active_idx');
        });

        // 5. Add compound index on jobs table for fast queue polling
        if (Schema::hasTable('jobs')) {
            Schema::table('jobs', function (Blueprint $table) {
                $table->index(['queue', 'reserved_at', 'available_at'], 'jobs_queue_reserved_available_idx');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('domains', function (Blueprint $table) {
            $table->dropIndex('domains_active_next_check_idx');
            $table->dropColumn(['check_interval', 'next_check_at']);
        });

        Schema::table('domain_status_events', function (Blueprint $table) {
            $table->dropIndex('dse_domain_region_checked_idx');
            $table->dropIndex('dse_domain_checked_idx');
        });

        Schema::table('incidents', function (Blueprint $table) {
            $table->dropIndex('incidents_domain_status_started_idx');
        });

        Schema::table('notification_channels', function (Blueprint $table) {
            $table->dropIndex('nc_workspace_domain_active_idx');
        });

        if (Schema::hasTable('jobs')) {
            Schema::table('jobs', function (Blueprint $table) {
                $table->dropIndex('jobs_queue_reserved_available_idx');
            });
        }
    }
};
