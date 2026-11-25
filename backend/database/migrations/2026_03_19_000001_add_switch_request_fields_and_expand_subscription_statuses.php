<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('subscriptions', function (Blueprint $table) {
            $table->foreignId('switch_requested_plan_price_id')
                ->nullable()
                ->after('scheduled_plan_price_id')
                ->constrained('plan_prices')
                ->nullOnDelete();

            $table->string('switch_requested_interval')
                ->nullable()
                ->after('switch_requested_plan_price_id');

            $table->timestamp('switch_requested_at')
                ->nullable()
                ->after('switch_requested_interval');
        });

        // Keep status enum aligned with runtime lifecycle statuses.
        DB::statement("ALTER TABLE subscriptions MODIFY COLUMN status ENUM(
            'created',
            'authenticated',
            'trialing',
            'active',
            'past_due',
            'pending',
            'failed_retrying',
            'halted',
            'cancel_at_cycle_end',
            'completed',
            'cancelled',
            'expired'
        ) DEFAULT 'trialing'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement("ALTER TABLE subscriptions MODIFY COLUMN status ENUM(
            'trialing',
            'active',
            'past_due',
            'pending',
            'halted',
            'cancelled',
            'expired'
        ) DEFAULT 'trialing'");

        Schema::table('subscriptions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('switch_requested_plan_price_id');
            $table->dropColumn(['switch_requested_interval', 'switch_requested_at']);
        });
    }
};
