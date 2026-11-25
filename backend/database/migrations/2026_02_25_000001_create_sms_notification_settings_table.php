<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sms_notification_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->boolean('sms_enabled')->default(false);
            $table->string('phone_number')->nullable();
            $table->unsignedInteger('down_threshold')->default(3);
            $table->unsignedInteger('ssl_days_before')->default(7);
            $table->timestamps();

            $table->unique('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sms_notification_settings');
    }
};
