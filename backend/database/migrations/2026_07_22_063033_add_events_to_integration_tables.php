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
        Schema::table('notification_channels', function (Blueprint $table) {
            $table->json('events')->nullable()->after('type');
        });
        Schema::table('sms_notification_settings', function (Blueprint $table) {
            $table->json('events')->nullable()->after('phone_number');
        });
        Schema::table('whatsapp_notification_settings', function (Blueprint $table) {
            $table->json('events')->nullable()->after('phone_number');
        });
    }

    public function down(): void
    {
        Schema::table('notification_channels', function (Blueprint $table) {
            $table->dropColumn('events');
        });
        Schema::table('sms_notification_settings', function (Blueprint $table) {
            $table->dropColumn('events');
        });
        Schema::table('whatsapp_notification_settings', function (Blueprint $table) {
            $table->dropColumn('events');
        });
    }
};
