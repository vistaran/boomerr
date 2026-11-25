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
        Schema::create('subscriptions', function (Blueprint $table) {
            $table->id();

            $table->foreignId('workspace_id')->constrained()->cascadeOnDelete();
            $table->foreignId('plan_price_id')->constrained()->cascadeOnDelete();

            $table->string('gateway')->nullable();
            $table->string('gateway_subscription_id')->nullable();
            $table->string('gateway_customer_id')->nullable();

            $table->enum('status', [
                'trialing',
                'active',
                'past_due',
                'pending',
                'halted',
                'cancelled',
                'expired'
            ])->default('trialing');

            $table->timestamp('trial_ends_at')->nullable();

            $table->timestamp('current_period_start')->nullable();
            $table->timestamp('current_period_end')->nullable();

            // Scheduled plan change (for upgrades/downgrades)
            $table->foreignId('scheduled_plan_price_id')->nullable()
                ->constrained('plan_prices')
                ->nullOnDelete();

            $table->timestamp('cancelled_at')->nullable();

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('subscriptions');
    }
};
