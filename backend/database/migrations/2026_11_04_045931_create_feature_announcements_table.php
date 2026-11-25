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
        Schema::create('feature_announcements', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('slug')->unique();
            $table->string('category')->default('general'); // monitoring, status_pages, notifications, billing, general
            $table->enum('status', ['coming_soon', 'in_beta', 'announced', 'live'])->default('coming_soon');
            $table->string('badge_text')->nullable(); // e.g., 'PREVIEW', 'HOT', 'NEW', 'SOON'
            $table->text('summary');
            $table->longText('description')->nullable();
            $table->string('cta_label')->nullable(); // e.g., 'Learn More', 'Try Preview'
            $table->string('cta_url')->nullable();
            $table->string('target_quarter')->nullable(); // e.g., 'Q4 2026', 'NOW'
            $table->date('release_date')->nullable();
            $table->boolean('is_pinned')->default(false);
            $table->boolean('is_published')->default(true);
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();

            $table->index(['status', 'is_published']);
            $table->index('is_pinned');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('feature_announcements');
    }
};
