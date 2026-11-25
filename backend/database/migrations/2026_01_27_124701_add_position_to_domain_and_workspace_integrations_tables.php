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
        Schema::table('domain_integrations', function (Blueprint $table) {
            $table->integer('position')->default(0)->after('enabled');
        });

        Schema::table('workspace_integrations', function (Blueprint $table) {
            $table->integer('position')->default(0)->after('enabled');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('domain_integrations', function (Blueprint $table) {
            $table->dropColumn('position');
        });

        Schema::table('workspace_integrations', function (Blueprint $table) {
            $table->dropColumn('position');
        });
    }
};
