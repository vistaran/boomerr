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
        Schema::table('boomerr_incidents', function (Blueprint $table) {
            $table->dropIndex(['status', 'started_at']);
            
            $table->string('incident_id', 50)->unique()->after('id')->nullable();
            
            $table->renameColumn('title', 'incident_title');
            $table->renameColumn('status', 'incident_status');
            $table->renameColumn('impact', 'incident_impact');
            $table->renameColumn('cause', 'incident_cause');
            $table->renameColumn('affected_services', 'incident_affected_services');
            $table->renameColumn('started_at', 'incident_started_at');
            $table->renameColumn('resolved_at', 'incident_resolved_at');
        });

        Schema::table('boomerr_incidents', function (Blueprint $table) {
            $table->index(['incident_status', 'incident_started_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('boomerr_incidents', function (Blueprint $table) {
            $table->dropIndex(['incident_status', 'incident_started_at']);
            
            $table->dropColumn('incident_id');
            
            $table->renameColumn('incident_title', 'title');
            $table->renameColumn('incident_status', 'status');
            $table->renameColumn('incident_impact', 'impact');
            $table->renameColumn('incident_cause', 'cause');
            $table->renameColumn('incident_affected_services', 'affected_services');
            $table->renameColumn('incident_started_at', 'started_at');
            $table->renameColumn('incident_resolved_at', 'resolved_at');
        });

        Schema::table('boomerr_incidents', function (Blueprint $table) {
            $table->index(['status', 'started_at']);
        });
    }
};
