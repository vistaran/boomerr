<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_transactions', function (Blueprint $table) {
            $table->id();

            $table->foreignId('workspace_id')->constrained()->cascadeOnDelete();
            $table->foreignId('subscription_id')->nullable()->constrained()->nullOnDelete();

            $table->string('gateway');
            $table->string('gateway_payment_id')->nullable()->index();

            // Amount in smallest currency unit (paise for INR, cents for USD)
            $table->unsignedInteger('amount')->nullable();
            $table->string('currency', 10)->default('INR');

            $table->enum('status', ['captured', 'failed', 'refunded'])->default('captured');

            $table->string('description')->nullable();

            $table->timestamp('paid_at')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_transactions');
    }
};
