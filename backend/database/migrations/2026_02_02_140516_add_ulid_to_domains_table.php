<?php

use App\Models\Domain;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Add nullable ULID column
        Schema::table('domains', function (Blueprint $table) {
            $table->ulid('ulid')->nullable()->after('id');
        });

        // 2. Backfill existing rows
        Domain::whereNull('ulid')
            ->orWhere('ulid', '')
            ->chunkById(500, function ($records) {
                foreach ($records as $record) {
                    $record->update([
                        'ulid' => strtolower((string) Str::ulid()),
                    ]);
                }
            });

        // 3. Enforce uniqueness
        Schema::table('domains', function (Blueprint $table) {
            $table->unique('ulid');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('domains', function (Blueprint $table) {
            $table->dropColumn('ulid');
        });
    }
};
