<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('integrations')->insertOrIgnore([
            'key' => 'clickup',
            'name' => 'ClickUp',
            'is_active' => true,
            'is_launched' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        DB::table('integrations')->where('key', 'clickup')->delete();
    }
};
