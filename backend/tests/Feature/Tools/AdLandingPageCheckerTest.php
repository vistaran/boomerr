<?php

namespace Tests\Feature\Tools;

use Tests\TestCase;

class AdLandingPageCheckerTest extends TestCase
{
    public function test_it_returns_422_when_url_is_missing(): void
    {
        $response = $this->getJson('/api/tools/ad-landing-page-checker');

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['url']);
    }

    public function test_it_inspects_valid_ad_landing_page_successfully(): void
    {
        $response = $this->getJson('/api/tools/ad-landing-page-checker?url=https://example.com');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'url',
                'data' => [
                    'is_up',
                    'status',
                    'health_score',
                    'verdict',
                    'status_code',
                    'final_url',
                    'metrics' => [
                        'total_time_ms',
                        'ttfb_ms',
                        'dns_time_ms',
                        'connect_time_ms',
                        'page_size_kb',
                    ],
                    'ssl' => [
                        'is_valid',
                    ],
                    'pixels' => [
                        'meta',
                        'google',
                        'tiktok',
                    ],
                    'risk_factors',
                    'recommendations',
                ],
            ]);

        $this->assertTrue($response->json('data.is_up'));
        $this->assertEquals(200, $response->json('data.status_code'));
    }
}
