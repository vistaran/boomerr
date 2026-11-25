<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('whatsapp_notification_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workspace_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name', 100);
            $table->boolean('whatsapp_enabled')->default(true);
            $table->string('phone_number', 30)->nullable();
            $table->unsignedTinyInteger('down_threshold')->default(3);
            $table->unsignedTinyInteger('ssl_days_before')->default(7);
            $table->string('content_sid')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('whatsapp_notification_settings');
    }
};
