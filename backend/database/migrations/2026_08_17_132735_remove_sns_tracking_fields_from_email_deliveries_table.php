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
        Schema::table('email_deliveries', function (Blueprint $table) {
            $table->dropColumn([
                'provider_message_id',
                'delivered_at',
                'opened_at',
                'clicked_at',
                'failed_at'
            ]);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('email_deliveries', function (Blueprint $table) {
            $table->string('provider_message_id')->nullable()->unique();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamp('opened_at')->nullable();
            $table->timestamp('clicked_at')->nullable();
            $table->timestamp('failed_at')->nullable();
        });
    }
};
