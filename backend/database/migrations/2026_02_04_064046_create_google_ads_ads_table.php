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
        Schema::create('google_ads_ads', function (Blueprint $table) {
            $table->id();
            $table->ulid('ulid')->unique();
            $table->foreignId('google_ads_campaign_id')->constrained('google_ads_campaigns')->onDelete('cascade');
            $table->string('ad_group_id')->index();
            $table->string('ad_id')->index();
            $table->string('name')->nullable();
            $table->string('status')->nullable(); // ENABLED, PAUSED, REMOVED
            $table->string('type')->nullable(); // RESPONSIVE_SEARCH_AD, etc.
            $table->json('headlines')->nullable();
            $table->json('descriptions')->nullable();
            $table->json('final_urls')->nullable();
            $table->json('meta_json')->nullable();
            $table->timestamps();

            $table->unique(['google_ads_campaign_id', 'ad_group_id', 'ad_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('google_ads_ads');
    }
};
