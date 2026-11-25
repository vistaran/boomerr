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
        Schema::table('system_logs', function (Blueprint $table) {
            $table->foreignId('incident_id')->nullable()->after('domain_id')->constrained('incidents')->nullOnDelete();
            $table->index(['incident_id', 'occurred_at'], 'system_logs_incident_time_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('system_logs', function (Blueprint $table) {
            $table->dropForeign(['incident_id']);
            $table->dropIndex('system_logs_incident_time_idx');
            $table->dropColumn('incident_id');
        });
    }
};
