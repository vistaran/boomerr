<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('domains', function (Blueprint $table) {
            $table->string('paused_reason', 50)->nullable()->after('is_active');
        });

        // Ensure any existing inactive domains are marked as user-paused
        DB::table('domains')
            ->where('is_active', false)
            ->whereNull('paused_reason')
            ->update(['paused_reason' => 'user']);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('domains', function (Blueprint $table) {
            $table->dropColumn('paused_reason');
        });
    }
};
