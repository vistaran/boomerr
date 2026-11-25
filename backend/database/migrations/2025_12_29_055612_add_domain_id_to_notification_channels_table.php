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
            $table->foreignId('domain_id')->nullable()->after('company_id')->constrained('domains')->nullOnDelete();

            $table->index(['company_id', 'domain_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('notification_channels', function (Blueprint $table) {
            $table->dropForeign(['domain_id']);
            $table->dropIndex(['company_id', 'domain_id']);
            $table->dropColumn('domain_id');
        });
    }
};
