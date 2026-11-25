<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sms_notification_settings', function (Blueprint $table) {
            $table->foreignId('domain_id')->nullable()->after('workspace_id')->constrained()->nullOnDelete();
        });

        Schema::table('whatsapp_notification_settings', function (Blueprint $table) {
            $table->foreignId('domain_id')->nullable()->after('workspace_id')->constrained()->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('sms_notification_settings', function (Blueprint $table) {
            $table->dropForeign(['domain_id']);
            $table->dropColumn('domain_id');
        });

        Schema::table('whatsapp_notification_settings', function (Blueprint $table) {
            $table->dropForeign(['domain_id']);
            $table->dropColumn('domain_id');
        });
    }
};
