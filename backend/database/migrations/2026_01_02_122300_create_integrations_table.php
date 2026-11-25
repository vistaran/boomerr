<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('integrations', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique(); // discord, slack, sms
            $table->string('name');          // Discord, Slack
            $table->boolean('is_active')->default(true); // platform-wide enable/disable
            $table->boolean('is_launched')->default(true); // platform-wide enable/disable
            $table->timestamps();
        });

        DB::table('integrations')->insert([
            ['key' => 'discord', 'name' => 'Discord'],
            ['key' => 'slack', 'name' => 'Slack'],
            ['key' => 'whatsapp', 'name' => 'WhatsApp'],
            ['key' => 'sms', 'name' => 'SMS'],
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('integrations');
    }
};
