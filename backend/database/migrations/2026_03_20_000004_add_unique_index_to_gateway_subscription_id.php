<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Check if unique constraint already exists to avoid duplicate key error
        $constraintExists = collect(DB::select("
            SELECT CONSTRAINT_NAME
            FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
            WHERE TABLE_NAME = 'subscriptions'
            AND CONSTRAINT_NAME = 'subscriptions_gateway_subscription_id_unique'
        "))->isNotEmpty();

        if (!$constraintExists) {
            Schema::table('subscriptions', function (Blueprint $table): void {
                $table->unique('gateway_subscription_id', 'subscriptions_gateway_subscription_id_unique');
            });
        }
    }

    public function down(): void
    {
        // Check if constraint exists before dropping
        $constraintExists = collect(DB::select("
            SELECT CONSTRAINT_NAME
            FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
            WHERE TABLE_NAME = 'subscriptions'
            AND CONSTRAINT_NAME = 'subscriptions_gateway_subscription_id_unique'
        "))->isNotEmpty();

        if ($constraintExists) {
            Schema::table('subscriptions', function (Blueprint $table): void {
                $table->dropUnique('subscriptions_gateway_subscription_id_unique');
            });
        }
    }
};
