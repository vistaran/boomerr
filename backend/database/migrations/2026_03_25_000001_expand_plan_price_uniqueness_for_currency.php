<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Add a 3-column unique index for (plan_id, interval, currency) if it doesn't exist.
        // We avoid dropping the existing 2-column unique index because MySQL may prevent
        // dropping it when it's required by foreign key constraints.
        $exists = DB::select("SHOW INDEX FROM plan_prices WHERE Key_name = 'plan_prices_plan_interval_currency_unique'");
        if (empty($exists)) {
            Schema::table('plan_prices', function (Blueprint $table): void {
                $table->unique(['plan_id', 'interval', 'currency'], 'plan_prices_plan_interval_currency_unique');
            });
        }
    }

    public function down(): void
    {
        // Drop the 3-column unique index if present. Do not attempt to recreate the
        // original 2-column unique here because it may be intentionally left.
        $exists = DB::select("SHOW INDEX FROM plan_prices WHERE Key_name = 'plan_prices_plan_interval_currency_unique'");
        if (!empty($exists)) {
            Schema::table('plan_prices', function (Blueprint $table): void {
                $table->dropUnique('plan_prices_plan_interval_currency_unique');
            });
        }
    }
};
