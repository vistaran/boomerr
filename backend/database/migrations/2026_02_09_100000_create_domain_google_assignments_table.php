<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('domain_google_assignments', function (Blueprint $table) {
            $table->id();
            $table->char('ulid', 26)->unique();
            $table->unsignedBigInteger('domain_id');
            $table->unsignedBigInteger('user_integration_id');
            $table->string('google_campaign_id');       // Google Ads campaign resource ID
            $table->string('google_account_id');         // Google Ads customer ID
            $table->string('campaign_name')->nullable(); // Display name for UI
            $table->string('campaign_status')->nullable(); // Current known status (ENABLED, PAUSED, REMOVED)
            $table->boolean('is_system_paused')->default(false);
            $table->timestamp('system_paused_at')->nullable();
            $table->string('original_status')->nullable(); // Status before system pause
            $table->timestamps();

            $table->foreign('domain_id')
                ->references('id')
                ->on('domains')
                ->onDelete('cascade');

            $table->foreign('user_integration_id')
                ->references('id')
                ->on('user_integrations')
                ->onDelete('cascade');

            // Prevent same Google campaign from being assigned to multiple domains
            $table->unique(['google_campaign_id', 'google_account_id'], 'unique_google_campaign');

            // Index for quick lookups
            $table->index(['domain_id', 'user_integration_id'], 'dga_domain_integration_idx');
            $table->index(['user_integration_id', 'google_campaign_id'], 'dga_integration_campaign_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('domain_google_assignments');
    }
};
