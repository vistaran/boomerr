<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('boomerr_incidents', function (Blueprint $table) {
            $table->id();
            $table->string('title', 255);
            $table->enum('status', ['investigating', 'identified', 'monitoring', 'resolved'])->default('investigating');
            $table->text('impact')->nullable();
            $table->text('cause')->nullable();
            $table->json('affected_services')->nullable(); // ["node-ap-south-1", "uptime-monitoring"]
            $table->timestamp('started_at');
            $table->timestamp('resolved_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('admins')->nullOnDelete();
            $table->timestamps();

            $table->index(['status', 'started_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('boomerr_incidents');
    }
};
