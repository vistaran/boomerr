<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasTable('workspace_whatsapp_usages')) {
            Schema::create('workspace_whatsapp_usages', function (Blueprint $table) {
                $table->id();
                $table->foreignId('workspace_id')->constrained('workspaces')->cascadeOnDelete();
                $table->string('year_month', 10);
                $table->unsignedInteger('credits_used')->default(0);
                $table->timestamps();

                $table->unique(['workspace_id', 'year_month'], 'workspace_whatsapp_usages_unique');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('workspace_whatsapp_usages');
    }
};
