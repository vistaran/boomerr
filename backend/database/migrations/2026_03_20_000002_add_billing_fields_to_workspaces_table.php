<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('workspaces', function (Blueprint $table): void {
            $table->foreignId('plan_id')->nullable()->after('timezone')->constrained('plans')->nullOnDelete();
            $table->string('billing_status')->default('free')->after('plan_id');
            $table->string('razorpay_subscription_id')->nullable()->after('billing_status')->index();
            $table->timestamp('trial_started_at')->nullable()->after('razorpay_subscription_id');
            $table->timestamp('trial_ends_at')->nullable()->after('trial_started_at');
            $table->timestamp('billing_cycle_ends_at')->nullable()->after('trial_ends_at');
            $table->boolean('cancel_at_cycle_end')->default(false)->after('billing_cycle_ends_at');
            $table->unsignedInteger('payment_fail_count')->default(0)->after('cancel_at_cycle_end');
            $table->timestamp('grace_period_ends_at')->nullable()->after('payment_fail_count');
            $table->boolean('subscription_creation_lock')->default(false)->after('grace_period_ends_at');
        });
    }

    public function down(): void
    {
        Schema::table('workspaces', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('plan_id');
            $table->dropColumn([
                'billing_status',
                'razorpay_subscription_id',
                'trial_started_at',
                'trial_ends_at',
                'billing_cycle_ends_at',
                'cancel_at_cycle_end',
                'payment_fail_count',
                'grace_period_ends_at',
                'subscription_creation_lock',
            ]);
        });
    }
};
