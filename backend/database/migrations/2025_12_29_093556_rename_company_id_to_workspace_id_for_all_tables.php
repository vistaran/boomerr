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
        Schema::table('workspace_id_for_all_tables', function (Blueprint $table) {
            Schema::table('departments', function (Blueprint $table) {
                $table->renameColumn('company_id', 'workspace_id');
            });
            Schema::table('department_user', function (Blueprint $table) {
                $table->renameColumn('company_id', 'workspace_id');
            });
            Schema::table('domains', function (Blueprint $table) {
                $table->renameColumn('company_id', 'workspace_id');
            });
            Schema::table('notification_channels', function (Blueprint $table) {
                $table->renameColumn('company_id', 'workspace_id');
            });
            Schema::table('roles', function (Blueprint $table) {
                $table->integer('workspace_id')->after('id');
            });
            Schema::table('team_invitations', function (Blueprint $table) {
                $table->renameColumn('company_id', 'workspace_id');
            });
            Schema::table('users', function (Blueprint $table) {
                $table->renameColumn('company_id', 'workspace_id');
            });
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::table('workspace_id_for_all_tables', function (Blueprint $table) {
            Schema::table('departments', function (Blueprint $table) {
                $table->renameColumn('workspace_id', 'company_id');
            });
            Schema::table('department_user', function (Blueprint $table) {
                $table->renameColumn('workspace_id', 'company_id');
            });
            Schema::table('domains', function (Blueprint $table) {
                $table->renameColumn('workspace_id', 'company_id');
            });
            Schema::table('notification_channels', function (Blueprint $table) {
                $table->renameColumn('workspace_id', 'company_id');
            });
            Schema::table('roles', function (Blueprint $table) {
                $table->dropColumn('workspace_id');
            });
            Schema::table('team_invitations', function (Blueprint $table) {
                $table->renameColumn('workspace_id', 'company_id');
            });
            Schema::table('users', function (Blueprint $table) {
                $table->renameColumn('workspace_id', 'company_id');
            });
        });
    }
};
