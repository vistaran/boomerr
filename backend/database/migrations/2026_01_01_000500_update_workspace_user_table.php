<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const TABLE = 'workspace_user';

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (! Schema::hasTable(self::TABLE)) {
            return;
        }

        $this->dropLegacyUniqueIndex();
        $this->ensurePairUniqueIndex();
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (! Schema::hasTable(self::TABLE)) {
            return;
        }

        if ($this->indexExists(self::TABLE, 'workspace_user_unique_pair')) {
            Schema::table(self::TABLE, function (Blueprint $table) {
                $table->dropUnique('workspace_user_unique_pair');
            });
        }

        if (! $this->indexExists(self::TABLE, 'workspace_user_unique')) {
            Schema::table(self::TABLE, function (Blueprint $table) {
                $table->unique(['workspace_id', 'user_id', 'role_id'], 'workspace_user_unique');
            });
        }
    }

    private function dropLegacyUniqueIndex(): void
    {
        // First, drop any foreign key constraints that depend on the unique index
        $foreignKeys = DB::select("
            SELECT CONSTRAINT_NAME
            FROM information_schema.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME != 'PRIMARY' AND REFERENCED_TABLE_NAME IS NOT NULL
        ", [DB::getDatabaseName(), self::TABLE]);

        foreach ($foreignKeys as $fk) {
            try {
                Schema::table(self::TABLE, function (Blueprint $table) use ($fk) {
                    $table->dropForeign($fk->CONSTRAINT_NAME);
                });
            } catch (\Throwable $e) {
                // Ignore if already dropped or not found
            }
        }

        if ($this->indexExists(self::TABLE, 'workspace_user_unique')) {
            Schema::table(self::TABLE, function (Blueprint $table) {
                $table->dropUnique('workspace_user_unique');
            });
            return;
        }

        if ($this->indexExists(self::TABLE, 'workspace_user_workspace_id_user_id_role_id_unique')) {
            Schema::table(self::TABLE, function (Blueprint $table) {
                $table->dropUnique(['workspace_id', 'user_id', 'role_id']);
            });
        }
    }

    private function ensurePairUniqueIndex(): void
    {
        if ($this->indexExists(self::TABLE, 'workspace_user_unique_pair')) {
            return;
        }

        Schema::table(self::TABLE, function (Blueprint $table) {
            $table->unique(['workspace_id', 'user_id'], 'workspace_user_unique_pair');
        });
    }

    private function indexExists(string $table, string $index): bool
    {
        return DB::table('information_schema.statistics')
            ->where('table_schema', DB::getDatabaseName())
            ->where('table_name', $table)
            ->where('index_name', $index)
            ->exists();
    }
};
