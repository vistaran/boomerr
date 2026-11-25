<?php

namespace Tests\Unit;

use Tests\TestCase;
use App\Services\PlanLimitService;
use App\Services\SmsCreditService;
use App\Services\WhatsAppCreditService;
use App\Services\AI\IncidentAIService;
use App\Services\AI\DomainAnalysisService;
use App\Models\Domain;
use App\Models\Incident;

class CommunityEditionTest extends TestCase
{
    public function setUp(): void
    {
        parent::setUp();
        config(['billing.enabled' => false]);
    }

    public function test_plan_code_evaluates_to_community_when_billing_disabled(): void
    {
        $this->assertSame('community', PlanLimitService::getPlanCode());
    }

    public function test_community_edition_limits_are_unlimited(): void
    {
        $config = PlanLimitService::getPlanConfig();

        $this->assertSame('Community Edition', $config['name']);
        $this->assertSame('community', $config['code']);
        $this->assertNull($config['limits']['max_monitors']);
        $this->assertNull($config['limits']['max_team_members']);
        $this->assertNull($config['limits']['max_status_pages']);
        $this->assertSame(1, $config['limits']['monitor_interval_minutes']);

        // Capacity helper methods must evaluate to true
        $this->assertTrue(PlanLimitService::canAddMonitor());
        $this->assertTrue(PlanLimitService::canAddTeamMember());
        $this->assertTrue(PlanLimitService::canAddStatusPage());
    }

    public function test_all_features_and_integrations_are_enabled_in_community_edition(): void
    {
        $config = PlanLimitService::getPlanConfig();

        $this->assertTrue($config['features']['domain_monitoring']);
        $this->assertTrue($config['features']['ssl_monitoring']);
        $this->assertTrue($config['features']['dns_tools']);
        $this->assertTrue($config['features']['security_tools']);
        $this->assertTrue($config['features']['incident_reporting']);

        $this->assertTrue($config['integrations']['email']);
        $this->assertTrue($config['integrations']['slack']);
        $this->assertTrue($config['integrations']['discord']);
        $this->assertTrue($config['integrations']['telegram']);
    }

    public function test_sms_credit_service_bypasses_limits_in_community_edition(): void
    {
        $smsService = app(SmsCreditService::class);

        $this->assertNull($smsService->getMonthlyLimit());
        $this->assertTrue($smsService->hasCredit());
        $this->assertTrue($smsService->reserveCredit());

        $details = $smsService->getCreditDetails();
        $this->assertTrue($details['has_credit']);
        $this->assertFalse($details['billing_enabled']);
        $this->assertNull($details['limit']);
    }

    public function test_whatsapp_credit_service_bypasses_limits_in_community_edition(): void
    {
        $whatsAppService = app(WhatsAppCreditService::class);

        $this->assertNull($whatsAppService->getMonthlyLimit());
        $this->assertTrue($whatsAppService->hasCredit());
        $this->assertTrue($whatsAppService->reserveCredit());

        $details = $whatsAppService->getCreditDetails();
        $this->assertTrue($details['has_credit']);
        $this->assertFalse($details['billing_enabled']);
        $this->assertNull($details['limit']);
    }

    public function test_ai_services_fallback_cleanly_when_api_keys_are_absent(): void
    {
        config(['services.ai.key' => null, 'services.deepseek.key' => null]);

        $domain = new Domain(['url' => 'https://example.com', 'name' => 'Test Domain']);
        $incident = new Incident([
            'http_status' => 503,
            'exception' => 'Service Unavailable',
            'started_at' => now(),
        ]);
        $incident->setRelation('domain', $domain);

        $incidentAIService = app(IncidentAIService::class);
        $incidentAnalysis = $incidentAIService->analyzeIncident($incident);
        $this->assertStringContainsString('missing DEEPSEEK_API_KEY', $incidentAnalysis);

        $domainAIService = app(DomainAnalysisService::class);
        $domainAnalysis = $domainAIService->analyze($domain);
        $this->assertIsInt($domainAnalysis['scores']['seo']);
        $this->assertIsInt($domainAnalysis['scores']['performance']);
        $this->assertNotEmpty($domainAnalysis['suggestions']['performance']);
        $this->assertNotEmpty($domainAnalysis['suggestions']['security']);
    }
}
