<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('subscriptions', function (Blueprint $table): void {
            // Supports lock/select patterns used during downgrade and webhook handling.
            $table->index(['workspace_id', 'status'], 'subscriptions_workspace_status_idx');
            $table->index(['workspace_id', 'gateway_subscription_id'], 'subscriptions_workspace_gateway_idx');
        });
    }

    public function down(): void
    {
        Schema::table('subscriptions', function (Blueprint $table): void {
            $table->dropIndex('subscriptions_workspace_status_idx');
            $table->dropIndex('subscriptions_workspace_gateway_idx');
        });
    }
};
