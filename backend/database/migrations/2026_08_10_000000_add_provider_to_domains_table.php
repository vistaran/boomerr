<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('domains', function (Blueprint $table) {
            if (!Schema::hasColumn('domains', 'provider')) {
                $table->string('provider', 100)->nullable()->after('workspace_id')->comment('e.g., shopify, manual');
            }
            if (!Schema::hasColumn('domains', 'provider_id')) {
                $table->string('provider_id', 100)->nullable()->after('provider')->comment('The ID from the provider system');
            }

            // Adding an index for fast lookups during synchronization
            if (!Schema::hasIndex('domains', 'domains_provider_provider_id_index', 'index')) {
                $table->index(['provider', 'provider_id']);
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('domains', function (Blueprint $table) {
            $table->dropIndex(['provider', 'provider_id']);
            $table->dropColumn(['provider', 'provider_id']);
        });
    }
};
