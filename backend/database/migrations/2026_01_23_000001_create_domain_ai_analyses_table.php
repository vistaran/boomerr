<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('domain_ai_analyses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('domain_id')->constrained()->cascadeOnDelete();
            $table->json('scores');
            $table->json('suggestions');
            $table->timestamps();

            $table->unique('domain_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('domain_ai_analyses');
    }
};
