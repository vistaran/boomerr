<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('plan_gateway_mappings', function (Blueprint $table) {
            $table->id();

            $table->foreignId('plan_price_id')
                ->constrained()
                ->cascadeOnDelete();

            $table->string('gateway'); // razorpay, stripe
            $table->string('gateway_plan_id');

            $table->timestamps();

            $table->unique(['plan_price_id', 'gateway']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('plan_gateway_mappings');
    }
};
