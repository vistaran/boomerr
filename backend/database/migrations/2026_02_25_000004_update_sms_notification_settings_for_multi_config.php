<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $fkExists = collect(DB::select("
            SELECT CONSTRAINT_NAME
            FROM information_schema.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'sms_notification_settings' AND CONSTRAINT_NAME = 'sms_notification_settings_user_id_foreign'
        ", [DB::getDatabaseName()]))->isNotEmpty();

        if ($fkExists) {
            Schema::table('sms_notification_settings', function (Blueprint $table) {
                $table->dropForeign(['user_id']);
            });
        }

        // 2️⃣ Drop UNIQUE index
        Schema::table('sms_notification_settings', function (Blueprint $table) {
            $table->dropUnique('sms_notification_settings_user_id_unique');
        });

        // 3️⃣ Add new fields
        Schema::table('sms_notification_settings', function (Blueprint $table) {

            $table->foreignId('workspace_id')
                ->nullable()
                ->after('id')
                ->constrained('workspaces')
                ->cascadeOnDelete();

            $table->string('name')
                ->default('Default')
                ->after('workspace_id');
        });
    }

    public function down(): void
    {
        Schema::table('sms_notification_settings', function (Blueprint $table) {

            $table->dropUnique(['user_id', 'workspace_id', 'name']);
            $table->dropConstrainedForeignId('workspace_id');
            $table->dropColumn('name');

            $table->unique('user_id');
        });
    }
};
