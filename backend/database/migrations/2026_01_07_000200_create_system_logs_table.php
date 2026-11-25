<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('system_logs', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->foreignId('workspace_id')->constrained('workspaces')->cascadeOnDelete();
            $table->foreignId('domain_id')->nullable()->constrained('domains')->nullOnDelete();
            $table->foreignId('domain_integration_id')->nullable()->constrained('domain_integrations')->nullOnDelete();
            $table->foreignId('notification_channel_id')->nullable()->constrained('notification_channels')->nullOnDelete();
            $table->foreignId('integration_id')->nullable()->constrained('integrations')->nullOnDelete();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('actor_type', 32)->nullable();
            $table->string('actor_name')->nullable();
            $table->string('actor_email')->nullable();
            $table->string('actor_role', 64)->nullable();
            $table->string('actor_department', 128)->nullable();
            $table->json('actor_snapshot')->nullable();
            $table->uuid('correlation_id')->nullable()->index();
            $table->string('event_type', 128);
            $table->string('source', 64)->nullable();
            $table->string('category', 64)->nullable();
            $table->string('status', 32)->default('info');
            $table->string('severity', 32)->default('info');
            $table->string('message')->nullable();
            $table->unsignedInteger('response_time_ms')->nullable();
            $table->string('error_code', 64)->nullable();
            $table->text('error_message')->nullable();
            $table->json('payload')->nullable();
            $table->text('sensitive_payload')->nullable();
            $table->timestamp('occurred_at')->useCurrent()->index();
            $table->timestamp('retention_expires_at')->nullable()->index();
            $table->timestamps();

            $table->index(['workspace_id', 'event_type', 'occurred_at'], 'system_logs_workspace_event_time_idx');
            $table->index(['domain_id', 'occurred_at'], 'system_logs_domain_time_idx');
            $table->index(['notification_channel_id', 'occurred_at'], 'system_logs_channel_time_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('system_logs');
    }
};
