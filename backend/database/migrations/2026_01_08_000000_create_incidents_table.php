<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('incidents', function (Blueprint $table) {
            $table->id();
            $table->ulid('ulid')->unique()->nullable();
            $table->foreignId('workspace_id')->constrained()->onDelete('cascade');
            $table->foreignId('domain_id')->constrained()->onDelete('cascade');
            $table->enum('status', ['ongoing', 'resolved'])->default('ongoing');
            $table->timestamp('started_at');
            $table->timestamp('resolved_at')->nullable();
            $table->string('screenshot_url')->nullable();
            $table->text('ai_analysis')->nullable();
            $table->json('extra_headers')->nullable();
            // New detailed fields
            $table->integer('http_status')->nullable();
            $table->json('response_headers')->nullable();
            $table->text('response_body')->nullable();
            $table->integer('duration_ms')->nullable();
            $table->text('exception')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('incidents');
    }
};
