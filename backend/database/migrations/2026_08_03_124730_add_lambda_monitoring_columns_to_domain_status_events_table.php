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
        Schema::table('domain_status_events', function (Blueprint $table) {
            $table->string('region')->nullable()->after('response_time_ms');
            $table->string('location')->nullable()->after('region');
            $table->timestamp('checked_at')->nullable()->after('location');
            $table->string('check_source')->nullable()->after('checked_at');
            $table->integer('http_status')->nullable()->after('check_source');

            $table->index('checked_at');
            $table->index('region');
            $table->index('check_source');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('domain_status_events', function (Blueprint $table) {
            $table->dropIndex(['checked_at']);
            $table->dropIndex(['region']);
            $table->dropIndex(['check_source']);
            $table->dropColumn(['region', 'location', 'checked_at', 'check_source', 'http_status']);
        });
    }
};
