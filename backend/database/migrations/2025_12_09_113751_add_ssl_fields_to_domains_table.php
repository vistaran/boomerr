<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('domains', function (Blueprint $table) {
            $table->string('ssl_issuer')->nullable()->after('last_checked_at');
            $table->timestamp('ssl_valid_from')->nullable()->after('ssl_issuer');
            $table->timestamp('ssl_valid_to')->nullable()->after('ssl_valid_from');
            $table->integer('ssl_days_remaining')->nullable()->after('ssl_valid_to');
            $table->timestamp('ssl_last_checked_at')->nullable()->after('ssl_days_remaining');
        });
    }

    public function down(): void
    {
        Schema::table('domains', function (Blueprint $table) {
            $table->dropColumn([
                'ssl_issuer',
                'ssl_valid_from',
                'ssl_valid_to',
                'ssl_days_remaining',
                'ssl_last_checked_at',
            ]);
        });
    }
};
