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
        Schema::table('monitoring_results', function (Blueprint $table) {
            $table->index(['domain_id', 'checked_at'], 'domain_checked_at_index');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('monitoring_results', function (Blueprint $table) {
            $table->dropIndex('domain_checked_at_index');
        });
    }
};
