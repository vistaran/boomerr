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
        Schema::create('incident_ai_chat', function (Blueprint $table) {
            $table->id();

            $table->foreignId('incident_id')
                ->constrained('incidents')
                ->cascadeOnDelete();

            $table->enum('role', ['user', 'ai']);
            $table->text('message');

            $table->timestamps();

            $table->index(['incident_id', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('incident_ai_chat');
    }
};
