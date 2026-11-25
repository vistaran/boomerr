<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('user_integrations', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('workspace_id');
            $table->string('provider'); // e.g., facebook_ads
            $table->string('account_id')->nullable();
            $table->text('access_token'); // encrypted
            $table->longText('meta_json')->nullable();
            $table->string('status')->default('active'); // active | revoked
            $table->timestamp('connected_at')->nullable();
            $table->timestamps();

            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('workspace_id')->references('id')->on('workspaces')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_integrations');
    }
};
