<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('workspace_id')->index();
            $table->string('event_type', 80)->index();
            $table->string('action', 40)->index();

            // Actor
            $table->unsignedBigInteger('actor_id')->nullable()->index();
            $table->string('actor_name', 255)->nullable();
            $table->string('actor_email', 255)->nullable();
            $table->string('actor_role', 40)->nullable();
            $table->string('actor_ip', 45)->nullable();
            $table->string('actor_user_agent', 500)->nullable();

            // Entity
            $table->string('entity_type', 80)->nullable();
            $table->string('entity_id', 80)->nullable();
            $table->string('entity_name', 255)->nullable();

            // Details
            $table->text('description')->nullable();
            $table->json('metadata')->nullable();
            $table->json('changes')->nullable();

            $table->timestamp('occurred_at')->index();
            $table->timestamps();

            // Composite indexes
            $table->index(['workspace_id', 'event_type', 'occurred_at']);
            $table->index(['workspace_id', 'action', 'occurred_at']);
            $table->index(['workspace_id', 'actor_id', 'occurred_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};
