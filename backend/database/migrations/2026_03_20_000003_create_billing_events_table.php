<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('billing_events', function (Blueprint $table): void {
            $table->id();
            $table->string('razorpay_event_id')->unique();
            $table->string('event_type')->index();
            $table->string('gateway_subscription_id')->nullable()->index();
            $table->string('gateway_payment_id')->nullable()->index();
            $table->json('payload')->nullable();
            $table->enum('status', ['processing', 'processed', 'ignored', 'failed'])->default('processing');
            $table->text('error_message')->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('billing_events');
    }
};
