<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Drop the old 2-column unique index if it exists.
        $old = DB::select("SHOW INDEX FROM plan_prices WHERE Key_name = 'plan_prices_plan_id_interval_unique'");
        if (!empty($old)) {
            DB::statement("ALTER TABLE plan_prices DROP INDEX plan_prices_plan_id_interval_unique");
        }

        // Create the new 3-column unique index if missing.
        $new = DB::select("SHOW INDEX FROM plan_prices WHERE Key_name = 'plan_prices_plan_interval_currency_unique'");
        if (empty($new)) {
            DB::statement("CREATE UNIQUE INDEX plan_prices_plan_interval_currency_unique ON plan_prices (plan_id, `interval`, currency)");
        }
    }

    public function down(): void
    {
        // Drop the 3-column unique index if present.
        $new = DB::select("SHOW INDEX FROM plan_prices WHERE Key_name = 'plan_prices_plan_interval_currency_unique'");
        if (!empty($new)) {
            DB::statement("ALTER TABLE plan_prices DROP INDEX plan_prices_plan_interval_currency_unique");
        }

        // Recreate the old 2-column unique index if missing.
        $old = DB::select("SHOW INDEX FROM plan_prices WHERE Key_name = 'plan_prices_plan_id_interval_unique'");
        if (empty($old)) {
            DB::statement("CREATE UNIQUE INDEX plan_prices_plan_id_interval_unique ON plan_prices (plan_id, `interval`)");
        }
    }
};
