<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('domain_status_events', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('domain_id');
            $table->string('status', 16); // up | down | unknown
            $table->timestamps();

            $table->index(['domain_id', 'created_at']);
            $table->index(['status', 'created_at']);
            $table->foreign('domain_id')
                ->references('id')->on('domains')
                ->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('domain_status_events');
    }
};
