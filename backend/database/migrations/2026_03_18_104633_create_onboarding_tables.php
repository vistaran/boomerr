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
        // Usage Plans Table
        Schema::create('onboarding_plans', function (Blueprint $table) {
            $table->id();
            $table->string('plan_id')->unique();
            $table->string('label');
            $table->text('description');
            $table->string('icon');
            $table->string('color');
            $table->integer('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // Company Sizes Table
        Schema::create('onboarding_company_sizes', function (Blueprint $table) {
            $table->id();
            $table->string('size_id')->unique();
            $table->string('label');
            $table->string('range')->nullable();
            $table->integer('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // Hear About Sources Table
        Schema::create('onboarding_sources', function (Blueprint $table) {
            $table->id();
            $table->string('source_id')->unique();
            $table->string('label');
            $table->string('icon');
            $table->string('color');
            $table->integer('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // Environment Options Table
        Schema::create('onboarding_environments', function (Blueprint $table) {
            $table->id();
            $table->string('value')->unique();
            $table->string('label');
            $table->string('icon');
            $table->text('description');
            $table->string('color');
            $table->string('bg_color');
            $table->string('border_color');
            $table->integer('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // Monitoring Features Table
        Schema::create('onboarding_features', function (Blueprint $table) {
            $table->id();
            $table->string('label');
            $table->string('icon');
            $table->integer('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // Welcome Highlights Table
        Schema::create('onboarding_highlights', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->text('description');
            $table->string('icon');
            $table->string('color');
            $table->integer('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // Suggestions Table
        Schema::create('onboarding_suggestions', function (Blueprint $table) {
            $table->id();
            $table->string('label');
            $table->string('icon');
            $table->string('color');
            $table->integer('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('onboarding_suggestions');
        Schema::dropIfExists('onboarding_highlights');
        Schema::dropIfExists('onboarding_features');
        Schema::dropIfExists('onboarding_environments');
        Schema::dropIfExists('onboarding_sources');
        Schema::dropIfExists('onboarding_company_sizes');
        Schema::dropIfExists('onboarding_plans');
    }
};
