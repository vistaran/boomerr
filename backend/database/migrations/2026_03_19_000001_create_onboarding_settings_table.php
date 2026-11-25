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
        Schema::create('onboarding_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workspace_id')->constrained()->onDelete('cascade');
            $table->string('setting_key')->nullable();
            $table->json('welcome_highlights')->nullable();
            $table->json('company_sizes')->nullable();
            $table->json('hear_about_sources')->nullable();
            $table->json('usage_plans')->nullable();
            $table->json('environment_options')->nullable();
            $table->json('monitoring_features')->nullable();
            $table->json('suggestions')->nullable();
            $table->timestamps();

            $table->index(['workspace_id', 'setting_key']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('onboarding_settings');
    }
};
