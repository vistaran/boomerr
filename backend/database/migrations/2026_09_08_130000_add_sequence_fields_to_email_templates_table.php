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
        Schema::table('email_templates', function (Blueprint $table) {
            $table->string('sequence_name', 100)->nullable()->index()->after('category');
            $table->unsignedInteger('step_order')->default(0)->after('sequence_name');
            $table->unsignedInteger('delay_value')->nullable()->after('step_order');
            $table->string('delay_unit', 20)->nullable()->after('delay_value'); // hours, days, weeks, months
            $table->string('trigger_event', 100)->nullable()->after('delay_unit'); // signup, first_domain_added, last_login, monitor_limit_reached, manual
            $table->string('trigger_condition', 255)->nullable()->after('trigger_event');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('email_templates', function (Blueprint $table) {
            $table->dropColumn([
                'sequence_name',
                'step_order',
                'delay_value',
                'delay_unit',
                'trigger_event',
                'trigger_condition',
            ]);
        });
    }
};
