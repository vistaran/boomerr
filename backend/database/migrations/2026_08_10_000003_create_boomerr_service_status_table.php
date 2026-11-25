<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('boomerr_service_status', function (Blueprint $table) {
            $table->string('service_id', 50)->primary(); // "uptime-monitoring", "ssl-monitoring" etc.
            $table->string('service_name', 100);
            $table->enum('status', ['operational', 'degraded', 'down'])->default('operational');
            $table->decimal('uptime_7d', 5, 2)->nullable();
            $table->decimal('uptime_30d', 5, 2)->nullable();
            $table->decimal('uptime_90d', 5, 2)->nullable();
            $table->integer('checks_today')->default(0);
            $table->integer('failures_today')->default(0);
            $table->timestamp('updated_at')->useCurrent();
        });

        // Seed the 5 core services
        DB::table('boomerr_service_status')->insert([
            ['service_id' => 'uptime-monitoring',   'service_name' => 'Website Uptime Monitoring',  'status' => 'operational', 'updated_at' => now()],
            ['service_id' => 'response-time',       'service_name' => 'Response Time Monitoring',   'status' => 'operational', 'updated_at' => now()],
            ['service_id' => 'ssl-monitoring',      'service_name' => 'SSL Certificate Monitoring', 'status' => 'operational', 'updated_at' => now()],
            ['service_id' => 'domain-expiry',       'service_name' => 'Domain Expiry Monitoring',   'status' => 'operational', 'updated_at' => now()],
            ['service_id' => 'ai-insights',         'service_name' => 'AI Site Insights',           'status' => 'operational', 'updated_at' => now()],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('boomerr_service_status');
    }
};
