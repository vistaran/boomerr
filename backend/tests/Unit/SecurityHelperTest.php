<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;
use App\Helpers\SecurityHelper;

class SecurityHelperTest extends TestCase
{
    public function test_blocks_cloud_metadata_ip(): void
    {
        $this->assertFalse(SecurityHelper::isSafeUrl('http://169.254.169.254/latest/meta-data'));
        $this->assertFalse(SecurityHelper::isSafeUrl('https://169.254.169.254/api'));
    }

    public function test_blocks_loopback_ips(): void
    {
        $this->assertFalse(SecurityHelper::isSafeUrl('http://127.0.0.1:8000'));
        $this->assertFalse(SecurityHelper::isSafeUrl('http://127.0.1.1/'));
        $this->assertFalse(SecurityHelper::isSafeUrl('http://[::1]/'));
    }

    public function test_blocks_rfc1918_private_ranges(): void
    {
        $this->assertFalse(SecurityHelper::isSafeUrl('http://10.0.0.1/admin'));
        $this->assertFalse(SecurityHelper::isSafeUrl('http://172.16.0.5/test'));
        $this->assertFalse(SecurityHelper::isSafeUrl('http://192.168.1.100/'));
    }

    public function test_blocks_non_http_schemes(): void
    {
        $this->assertFalse(SecurityHelper::isSafeUrl('file:///etc/passwd'));
        $this->assertFalse(SecurityHelper::isSafeUrl('gopher://127.0.0.1:70/'));
        $this->assertFalse(SecurityHelper::isSafeUrl('ftp://example.com/test'));
        $this->assertFalse(SecurityHelper::isSafeUrl('javascript:alert(1)'));
    }

    public function test_ip_public_validation(): void
    {
        $this->assertTrue(SecurityHelper::isPublicIp('8.8.8.8'));
        $this->assertTrue(SecurityHelper::isPublicIp('1.1.1.1'));
        $this->assertFalse(SecurityHelper::isPublicIp('127.0.0.1'));
        $this->assertFalse(SecurityHelper::isPublicIp('192.168.0.1'));
        $this->assertFalse(SecurityHelper::isPublicIp('10.254.0.1'));
        $this->assertFalse(SecurityHelper::isPublicIp('172.16.0.1'));
        $this->assertFalse(SecurityHelper::isPublicIp('169.254.1.1'));
        $this->assertFalse(SecurityHelper::isPublicIp('::1'));
        $this->assertFalse(SecurityHelper::isPublicIp('fc00::1'));
    }
}
