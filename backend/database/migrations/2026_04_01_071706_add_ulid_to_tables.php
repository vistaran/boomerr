<?php

use App\Models\Department;
use App\Models\DomainIntegration;
use App\Models\NotificationChannel;
use App\Models\TeamInvitation;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // add nullable ULID columns first
        Schema::table('workspaces', function (Blueprint $table) {
            $table->ulid('ulid')->nullable()->after('id');
        });

        Schema::table('domain_integrations', function (Blueprint $table) {
            $table->ulid('ulid')->nullable()->after('id');
        });

        Schema::table('departments', function (Blueprint $table) {
            $table->ulid('ulid')->nullable()->after('id');
        });

        Schema::table('team_invitations', function (Blueprint $table) {
            $table->ulid('ulid')->nullable()->after('id');
        });

        Schema::table('notification_channels', function (Blueprint $table) {
            $table->ulid('ulid')->nullable()->after('id');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->ulid('ulid')->nullable()->after('id');
        });

        // 2. Backfill existing rows
        Workspace::whereNull('ulid')
            ->orWhere('ulid', '')
            ->chunkById(500, function ($records) {
                foreach ($records as $record) {
                    $record->update([
                        'ulid' => strtolower((string) Str::ulid()),
                    ]);
                }
            });

        Department::whereNull('ulid')
            ->orWhere('ulid', '')
            ->chunkById(500, function ($records) {
                foreach ($records as $record) {
                    $record->update([
                        'ulid' => strtolower((string) Str::ulid()),
                    ]);
                }
            });

        DomainIntegration::whereNull('ulid')
            ->orWhere('ulid', '')
            ->chunkById(500, function ($records) {
                foreach ($records as $record) {
                    $record->update([
                        'ulid' => strtolower((string) Str::ulid()),
                    ]);
                }
            });

        TeamInvitation::whereNull('ulid')
            ->orWhere('ulid', '')
            ->chunkById(500, function ($records) {
                foreach ($records as $record) {
                    $record->update([
                        'ulid' => strtolower((string) Str::ulid()),
                    ]);
                }
            });

        NotificationChannel::whereNull('ulid')
            ->orWhere('ulid', '')
            ->chunkById(500, function ($records) {
                foreach ($records as $record) {
                    $record->update([
                        'ulid' => strtolower((string) Str::ulid()),
                    ]);
                }
            });

        User::whereNull('ulid')
            ->orWhere('ulid', '')
            ->chunkById(500, function ($records) {
                foreach ($records as $record) {
                    $record->update([
                        'ulid' => strtolower((string) Str::ulid()),
                    ]);
                }
            });

        // 3. Enforce uniqueness
        Schema::table('workspaces', function (Blueprint $table) {
            $table->unique('ulid');
        });

        Schema::table('domain_integrations', function (Blueprint $table) {
            $table->unique('ulid');
        });

        Schema::table('departments', function (Blueprint $table) {
            $table->unique('ulid');
        });

        Schema::table('team_invitations', function (Blueprint $table) {
            $table->unique('ulid');
        });

        Schema::table('notification_channels', function (Blueprint $table) {
            $table->unique('ulid');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->unique('ulid');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('workspaces', function (Blueprint $table) {
            // remove unique index if present then drop column
            $table->dropUnique(['ulid']);
            $table->dropColumn('ulid');
        });

        Schema::table('domain_integrations', function (Blueprint $table) {
            // remove unique index if present then drop column
            $table->dropUnique(['ulid']);
            $table->dropColumn('ulid');
        });

        Schema::table('departments', function (Blueprint $table) {
            // remove unique index if present then drop column
            $table->dropUnique(['ulid']);
            $table->dropColumn('ulid');
        });

        Schema::table('team_invitations', function (Blueprint $table) {
            $table->dropUnique(['ulid']);
            $table->dropColumn('ulid');
        });

        Schema::table('notification_channels', function (Blueprint $table) {
            $table->dropUnique(['ulid']);
            $table->dropColumn('ulid');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['ulid']);
            $table->dropColumn('ulid');
        });
    }
};
