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
        Schema::create('integration_deliveries', function (Blueprint $table) {
            $table->id();
            $table->ulid('ulid')->unique();
            $table->morphs('deliverable'); // deliverable_id, deliverable_type
            $table->string('event_id')->nullable();
            $table->string('event_name')->nullable();
            $table->integer('http_status')->nullable();
            $table->string('status');
            $table->integer('attempt')->default(1);
            $table->json('request_payload')->nullable();
            $table->json('response_headers')->nullable();
            $table->text('response_body')->nullable();
            $table->integer('duration_ms')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('integration_deliveries');
    }
};
