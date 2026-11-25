<?php

// database/migrations/xxxx_xx_xx_create_plan_prices_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('plan_prices', function (Blueprint $table) {
            $table->id();

            $table->foreignId('plan_id')
                ->constrained()
                ->cascadeOnDelete();

            $table->enum('interval', ['monthly', 'yearly']);
            $table->integer('price');
            $table->string('currency')->default('USD');

            $table->boolean('is_active')->default(true);

            $table->timestamps();

            $table->unique(['plan_id', 'interval']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('plan_prices');
    }
};
