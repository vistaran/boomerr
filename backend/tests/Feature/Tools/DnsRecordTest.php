<?php

namespace Tests\Feature\Tools;

use Tests\TestCase;

class DnsRecordTest extends TestCase
{
    public function test_it_returns_422_when_domain_is_missing(): void
    {
        $response = $this->getJson('/api/tools/dns-records');

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['domain']);
    }

    public function test_it_returns_422_for_invalid_domain_format(): void
    {
        $response = $this->getJson('/api/tools/dns-records?domain=invalid..domain');

        $response->assertStatus(422)
            ->assertJson([
                'error' => 'Invalid domain format provided.',
            ]);
    }

    public function test_it_resolves_dns_records_within_acceptable_time(): void
    {
        $startTime = microtime(true);
        $response = $this->getJson('/api/tools/dns-records?domain=google.com');
        $duration = microtime(true) - $startTime;

        $response->assertStatus(200)
            ->assertJsonStructure([
                'domain',
                'records' => [
                    'A',
                    'AAAA',
                    'CNAME',
                    'MX',
                    'TXT',
                    'NS',
                ],
            ]);

        $this->assertEquals('google.com', $response->json('domain'));
        $this->assertNotEmpty($response->json('records.A'));
        $this->assertLessThan(3.0, $duration, 'DNS resolution took longer than 3 seconds.');
    }

    public function test_it_normalizes_domain_with_protocol_and_trailing_slashes(): void
    {
        $response = $this->getJson('/api/tools/dns-records?domain=https://example.com/path/test');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'domain',
                'records' => [
                    'A',
                    'AAAA',
                    'CNAME',
                    'MX',
                    'TXT',
                    'NS',
                ],
            ]);

        $this->assertEquals('example.com', $response->json('domain'));
    }
}
