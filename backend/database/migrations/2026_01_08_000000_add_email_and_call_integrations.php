<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Add email and call integrations if they don't exist
        $existingKeys = DB::table('integrations')->pluck('key')->toArray();

        $integrations = [
            ['key' => 'email', 'name' => 'Email', 'is_active' => true, 'is_launched' => true],
            ['key' => 'call', 'name' => 'Call', 'is_active' => true, 'is_launched' => false],
        ];

        foreach ($integrations as $integration) {
            if (!in_array($integration['key'], $existingKeys)) {
                DB::table('integrations')->insert(array_merge($integration, [
                    'created_at' => now(),
                    'updated_at' => now(),
                ]));
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('integrations')->whereIn('key', ['email', 'call'])->delete();
    }
};
