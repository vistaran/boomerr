<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('domain_facebook_assignments', function (Blueprint $table) {
            $table->id();
            $table->char('ulid', 26)->unique();
            $table->unsignedBigInteger('domain_id');
            $table->unsignedBigInteger('user_integration_id'); // FK to user_integrations (Facebook ad account)
            $table->string('facebook_entity_id'); // Campaign or Ad ID from Facebook
            $table->string('facebook_entity_type')->default('ad'); // 'ad' or 'campaign'
            $table->string('facebook_entity_name')->nullable(); // Display name for UI
            $table->boolean('is_system_paused')->default(false); // True if paused by auto-pause
            $table->timestamp('system_paused_at')->nullable(); // When system paused it
            $table->string('original_status')->nullable(); // Status before system pause (ACTIVE, PAUSED, etc.)
            $table->timestamps();

            $table->foreign('domain_id')
                ->references('id')
                ->on('domains')
                ->onDelete('cascade');

            $table->foreign('user_integration_id')
                ->references('id')
                ->on('user_integrations')
                ->onDelete('cascade');

            // Prevent same Facebook entity from being assigned to multiple domains
            $table->unique(['facebook_entity_id', 'facebook_entity_type'], 'unique_facebook_entity');

            // Index for quick lookups
            $table->index(['domain_id', 'user_integration_id'], 'dfa_domain_integration_idx');
            $table->index(['user_integration_id', 'facebook_entity_id'], 'dfa_integration_entity_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('domain_facebook_assignments');
    }
};
