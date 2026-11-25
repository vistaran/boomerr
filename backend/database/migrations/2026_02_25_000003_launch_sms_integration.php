<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('integrations')
            ->where('key', 'sms')
            ->update([
                'is_launched'             => true,
                'is_configuration_needed' => true,
                'updated_at'              => now(),
            ]);
    }

    public function down(): void
    {
        DB::table('integrations')
            ->where('key', 'sms')
            ->update([
                'is_launched'             => false,
                'is_configuration_needed' => false,
                'updated_at'              => now(),
            ]);
    }
};
