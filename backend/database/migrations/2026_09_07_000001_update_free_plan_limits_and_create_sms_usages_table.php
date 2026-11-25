<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('workspace_sms_usages')) {
            Schema::create('workspace_sms_usages', function (Blueprint $table) {
                $table->id();
                $table->foreignId('workspace_id')->constrained('workspaces')->cascadeOnDelete();
                $table->string('year_month', 7); // e.g. '2026-09'
                $table->unsignedInteger('credits_used')->default(0);
                $table->timestamps();

                $table->unique(['workspace_id', 'year_month'], 'workspace_sms_usages_unique');
            });
        }

        // Update plans table with new limits
        DB::table('plans')->where('code', 'free')->update([
            'max_domains' => 50,
            'max_status_pages' => 1,
        ]);

        // Ensure max_status_pages is seeded for existing plans if null
        DB::table('plans')->where('code', 'starter')->whereNull('max_status_pages')->update(['max_status_pages' => 3]);
        DB::table('plans')->where('code', 'solopreneur')->whereNull('max_status_pages')->update(['max_status_pages' => 5]);
        DB::table('plans')->where('code', 'teams')->whereNull('max_status_pages')->update(['max_status_pages' => 10]);
    }

    public function down(): void
    {
        Schema::dropIfExists('workspace_sms_usages');

        DB::table('plans')->where('code', 'free')->update([
            'max_domains' => 1,
            'max_status_pages' => 1,
        ]);
    }
};
