<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shopify_stores', function (Blueprint $table) {
            $table->id();
            $table->string('shop')->unique()->comment('Shopify store domain, e.g. mystore.myshopify.com');
            $table->text('access_token')->comment('OAuth access token issued by Shopify');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shopify_stores');
    }
};
