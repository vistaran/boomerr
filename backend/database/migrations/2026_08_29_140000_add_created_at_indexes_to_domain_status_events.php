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
        Schema::table('domain_status_events', function (Blueprint $table) {
            $table->index(['domain_id', 'created_at'], 'dse_domain_created_idx');
            $table->index(['domain_id', 'region', 'created_at'], 'dse_domain_region_created_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('domain_status_events', function (Blueprint $table) {
            $table->dropIndex('dse_domain_created_idx');
            $table->dropIndex('dse_domain_region_created_idx');
        });
    }
};
