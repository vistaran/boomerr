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
        Schema::create('domains', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->onDelete('cascade');
            $table->string('name'); // example.com
            $table->string('url');  // https://example.com
            $table->string('label')->nullable();
            $table->string('environment')->default('production'); // prod/staging/etc
            $table->boolean('is_active')->default(true);
            $table->enum('status', ['unknown', 'up', 'down'])->default('unknown');
            $table->integer('last_response_time_ms')->nullable();
            $table->timestamp('last_checked_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('domains');
    }
};
