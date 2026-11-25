<?php

namespace Tests\Feature;

use Tests\TestCase;

class PublicConfigEndpointTest extends TestCase
{
    public function test_api_config_returns_runtime_configuration_without_billing(): void
    {
        config(['billing.enabled' => false]);

        $response = $this->getJson('/api/config');

        $response->assertStatus(200);
        $response->assertJson([
            'billing_enabled' => false,
        ]);
        $response->assertJsonStructure([
            'app_name',
            'reverb_key',
            'hcaptcha_site_key',
            'billing_enabled',
        ]);
    }

    public function test_api_health_endpoint_returns_ok(): void
    {
        $response = $this->getJson('/api/health');

        $response->assertStatus(200);
        $response->assertJson([
            'status' => 'ok',
        ]);
    }
}
