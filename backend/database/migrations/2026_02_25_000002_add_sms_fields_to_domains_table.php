<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('domains', function (Blueprint $table) {
            $table->unsignedInteger('failure_count')->default(0)->after('ssl_expiry_notified_days');
            $table->timestamp('last_sms_at')->nullable()->after('failure_count');
        });
    }

    public function down(): void
    {
        Schema::table('domains', function (Blueprint $table) {
            $table->dropColumn(['failure_count', 'last_sms_at']);
        });
    }
};
