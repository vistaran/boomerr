<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::statement("ALTER TABLE subscriptions MODIFY COLUMN status ENUM('created', 'authenticated', 'trialing', 'active', 'past_due', 'pending', 'failed_retrying', 'halted', 'paused', 'cancel_at_cycle_end', 'completed', 'expired', 'cancelled') NOT NULL DEFAULT 'trialing'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement("ALTER TABLE subscriptions MODIFY COLUMN status ENUM('trialing', 'active', 'past_due', 'pending', 'halted', 'cancelled', 'expired') NOT NULL DEFAULT 'trialing'");
    }
};

