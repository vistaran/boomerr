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
        Schema::table('domains', function (Blueprint $table) {
            $table->timestamp('domain_expires_at')->nullable()->after('ssl_last_checked_at');
            $table->integer('domain_days_remaining')->nullable()->after('domain_expires_at');
            $table->timestamp('domain_last_checked_at')->nullable()->after('domain_days_remaining');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('domains', function (Blueprint $table) {
            $table->dropColumn([
                'domain_expires_at',
                'domain_days_remaining',
                'domain_last_checked_at'
            ]);
        });
    }
};
