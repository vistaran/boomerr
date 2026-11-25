<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('subscriptions', function (Blueprint $table): void {
            $table->string('currency', 10)->nullable()->after('gateway_customer_id');
            $table->unsignedInteger('unit_amount')->nullable()->after('currency');
        });

        DB::statement('
            UPDATE subscriptions s
            INNER JOIN plan_prices pp ON pp.id = s.plan_price_id
            SET s.currency = COALESCE(s.currency, pp.currency),
                s.unit_amount = COALESCE(s.unit_amount, pp.price)
        ');
    }

    public function down(): void
    {
        Schema::table('subscriptions', function (Blueprint $table): void {
            $table->dropColumn(['currency', 'unit_amount']);
        });
    }
};
