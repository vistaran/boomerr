<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('node_heartbeats', function (Blueprint $table) {
            $table->id();
            $table->string('node_id', 50)->index();        // e.g. "node-ap-south-1"
            $table->string('aws_region', 50)->index();     // e.g. "ap-south-1"
            $table->enum('status', ['healthy', 'degraded', 'down'])->default('healthy');
            $table->integer('latency_ms')->nullable();
            $table->integer('checks_run_24h')->nullable();
            $table->decimal('success_rate_24h', 5, 2)->nullable();
            $table->timestamp('created_at')->useCurrent()->index();
            $table->timestamp('updated_at')->useCurrent();

            $table->index(['node_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('node_heartbeats');
    }
};
