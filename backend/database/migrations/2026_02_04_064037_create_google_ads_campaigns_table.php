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
        Schema::create('google_ads_campaigns', function (Blueprint $table) {
            $table->id();
            $table->ulid('ulid')->unique();
            $table->foreignId('google_ads_account_id')->constrained('google_ads_accounts')->onDelete('cascade');
            $table->string('campaign_id')->index(); // Google Ads campaign ID
            $table->string('name');
            $table->string('status')->nullable(); // ENABLED, PAUSED, REMOVED
            $table->string('advertising_channel_type')->nullable(); // SEARCH, DISPLAY, VIDEO, etc.
            $table->bigInteger('budget_micros')->nullable();
            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();
            $table->json('meta_json')->nullable();
            $table->timestamps();

            $table->unique(['google_ads_account_id', 'campaign_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('google_ads_campaigns');
    }
};
