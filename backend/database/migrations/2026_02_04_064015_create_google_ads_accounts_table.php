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
        Schema::create('google_ads_accounts', function (Blueprint $table) {
            $table->id();
            $table->ulid('ulid')->unique();
            $table->foreignId('user_integration_id')->constrained('user_integrations')->onDelete('cascade');
            $table->string('customer_id')->index(); // Google Ads customer ID (e.g., 1234567890)
            $table->string('descriptive_name')->nullable();
            $table->string('currency_code', 10)->nullable();
            $table->string('time_zone')->nullable();
            $table->boolean('is_manager')->default(false);
            $table->boolean('is_active')->default(true);
            $table->json('meta_json')->nullable();
            $table->timestamps();

            $table->unique(['user_integration_id', 'customer_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('google_ads_accounts');
    }
};
