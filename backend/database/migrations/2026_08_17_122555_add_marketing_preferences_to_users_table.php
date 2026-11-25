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
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('receives_onboarding_emails')->default(true)->after('email');
            $table->boolean('receives_product_updates')->default(true)->after('receives_onboarding_emails');
            $table->boolean('receives_newsletters')->default(true)->after('receives_product_updates');
            $table->boolean('receives_promotional_emails')->default(true)->after('receives_newsletters');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'receives_onboarding_emails',
                'receives_product_updates',
                'receives_newsletters',
                'receives_promotional_emails'
            ]);
        });
    }
};
