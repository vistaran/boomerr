# Open-Source Readiness Audit & Migration Strategy

## 1. Item-by-Item Codebase Remediation Inventory

Before making Boomerr public, all commercial, proprietary, and environment-locked constructs must be addressed. Each item is classified with a specific engineering recommendation: **Keep, Make Configurable, Replace, Make Optional, Remove, or Document**.

| Codebase Item | Current Location / Implementation | Impact on Open Source | Recommendation | Engineering Action Required |
|---|---|---|---|---|
| **Proprietary SaaS Branding** | `Boomerr`, `boomerr.ai`, `app.boomerr.ai` across views and frontend | Confusing for self-hosters; ties product to company | **Make Configurable** | Replace hardcoded text with `APP_NAME` from `.env` and `VITE_APP_NAME`. Default branding to "Boomerr Community Edition". |
| **Razorpay Billing System** | `app/Services/Billing/`, `config/billing.php`, `BillingController` | Hard-locks features; assumes payment gateway | **Make Optional / Bypass** | Add `ENABLE_BILLING=false` in `.env`. When disabled, all features and limits become **unlimited** by default. |
| **Plan & Feature Limits** | `app/Services/PlanLimitService.php` restricting free accounts to 10 monitors | Self-hosters locked out of SSL, AI, and frequent checks | **Make Configurable** | In `PlanLimitService`, if `ENABLE_BILLING=false`, return `unlimited` for monitors, 1-minute intervals, and enable all features. |
| **hCaptcha Gatekeeper** | `AuthController.php`, `Admin\AuthController.php` requiring tokens | Blocks registration and login if hCaptcha keys are absent | **Make Optional** | Check `if (empty(config('services.hcaptcha.secret')))` in validation rules. If omitted, completely skip captcha check. |
| **AWS S3 Hardcoded Region** | `IncidentRecorderService.php` (`'region' => 'ap-south-1'`) | Screenshot uploads crash if S3 not configured | **Replace** | Refactor to Laravel `Storage::disk(config('filesystems.default'))` with local public storage fallback. |
| **Google Tag Manager** | `frontend/index.html` (`G-YDE08CL8FW`) | Leaks self-hosted telemetry to company account | **Remove** | Remove the GTM script tag from `frontend/index.html`. Allow optional custom tracking injection via `.env`. |
| **Discord Exception Logger** | `backend/bootstrap/app.php` | Posts self-hosted stack traces to company Discord | **Remove** | Remove the hardcoded Discord exception report in `bootstrap/app.php`. Rely on standard Laravel logging. |
| **Debug Test Endpoints** | `routes/api.php` (`/_debug/log-test`, `/_debug/sms-test`) | Security hazard in production routes | **Remove** | Delete debug routes from `routes/api.php`. |
| **Ad-Hoc Development Files** | `repair_db.php`, `backend/scaffold_*.php`, `dummy.php`, etc. | Clutters repo; contains test data and debug logic | **Remove** | Delete all 12 identified ad-hoc scripts before publishing. |
| **AWS Lambda Multi-Region** | `RunLambdaUptimeChecks.php`, `MonitoringDispatcherService.php` | Cloud infrastructure dependency | **Make Optional** | Keep default `MONITORING_LAMBDA_ENABLED=false`. Document as advanced cloud mode; local checks run by default. |
| **DeepSeek / OpenAI AI** | `IncidentAIService.php`, `DomainAnalysisService.php` | Requires paid API key | **Make Optional** | Gracefully disable AI if `DEEPSEEK_API_KEY` is not set; add configurable endpoint for local Ollama instances. |
| **Ads Protection (Meta/Google)** | `GoogleAdsService.php`, `FacebookAdsAssignmentService.php` | Requires OAuth app credentials | **Make Optional** | Kept intact. Disabled by default unless user sets up their own developer tokens. |
| **Shopify App OAuth & Routes** | `ShopifyAuthController.php`, `resources/views/app.blade.php` | Specific to company's Shopify App Store listing | **Make Optional** | Keep code but make Shopify redirects bypassable when not running in an embedded iframe. |
| **Admin Seeder & Onboarding** | `Admin.php`, `OnboardingSeeder.php`, `RolesSeeder.php` | First-time installation requires admin access | **Replace** | Create an artisan command `php artisan boomerr:admin:create` to safely prompt for admin credentials on first install. |

---

## 2. Decoupling Commercial Billing & Plan Enforcement

### 2.1 The Current SaaS Restriction Logic
Currently, `PlanLimitService` checks `workspace->activeSubscription`. If no active paid subscription is found, it defaults to the `free` plan defined in `config/billing.php`:
- `max_monitors`: 10
- `monitor_interval_minutes`: 5
- `ssl_monitoring`: `false` (SSL checks disabled!)
- `ai_analysis`: `false`
- `security_tools`: `false`
- `incident_reporting`: `false`
- `multi_region_monitoring`: `false`

### 2.2 The Open-Source Community Architecture
To make Boomerr an open-source tool while preserving the option for companies to run commercial SaaS instances:

1. **Introduce `COMMUNITY_EDITION=true` or `ENABLE_BILLING=false` in `.env`:**
   In `app/Services/PlanLimitService.php`:
   ```php
   public static function getPlanConfig(Workspace $workspace): array
   {
       if (!config('billing.enabled', true)) {
           return [
               'name' => 'Community Edition',
               'code' => 'community',
               'limits' => [
                   'max_monitors' => null, // Unlimited
                   'monitor_interval_minutes' => 1,
                   'max_team_members' => null, // Unlimited
                   'max_status_pages' => null, // Unlimited
                   'sms_credits_per_month' => 999999,
                   'whatsapp_credits_per_month' => 999999,
               ],
               'features' => [
                   'domain_monitoring' => true,
                   'ssl_monitoring' => true,
                   'ai_response_time' => true,
                   'ai_performance' => true,
                   'ai_seo_score' => true,
                   'ai_ux_monitoring' => true,
                   'ai_security_monitoring' => true,
                   'dns_tools' => true,
                   'security_tools' => true,
                   'incident_reporting' => true,
                   'ai_analysis' => true,
                   'multi_region_monitoring' => false,
               ],
               'integrations' => [
                   'email' => true,
                   'sms' => true,
                   'whatsapp' => true,
                   'calls' => true,
                   'slack' => true,
                   'discord' => true,
                   'telegram' => true,
                   'facebook_ads' => true,
                   'google_ads' => true,
               ],
           ];
       }
       // Fallback to commercial plans if billing is explicitly enabled
       ...
   }
   ```

2. **Frontend Billing Navigation:**
   In `frontend/src/`, if `ENABLE_BILLING` is false, hide the `/billing` tab or display a "Community Edition — Unlimited Plan" badge.

---

## 3. Open-Source License Evaluation

Choosing the right license is a strategic business decision that dictates how others can use, modify, redistribute, or monetize Boomerr.

### 3.1 License Comparison Matrix

| Factor | MIT License | Apache 2.0 | AGPL v3.0 (Affero GPL) |
|---|---|---|---|
| **License Type** | Permissive | Permissive with Patent Grants | Strong Copyleft (Network Clause) |
| **Can commercial competitors re-host as paid SaaS?** | **Yes, without sharing code** | **Yes, without sharing code** | **NO** (Must publish all backend modifications) |
| **Are modifications required to be open-sourced?** | No | No | **Yes**, even when provided over a network/API |
| **Explicit Patent Grant Protection?** | No | **Yes** | **Yes** |
| **Trademark Protection?** | No | **Yes** (Protects "Boomerr" name) | **Yes** |
| **Adoption Friction for Enterprise Self-Hosters?** | Low | Low | Medium (Some corporate legal teams avoid AGPL) |
| **Protection against Hyperscalers (AWS, Cloud providers)?** | None | None | **Maximum** |

### 3.2 Evaluation of Options

1. **MIT License:**
   - *Pros:* Maximum developer adoption, zero legal friction, widely loved by open-source enthusiasts.
   - *Risks:* A cloud provider or competitor can take the entire Boomerr codebase, rebrand it, close the source, and sell it as a competing commercial SaaS without contributing back a single line of code.

2. **Apache 2.0 License:**
   - *Pros:* Permissive like MIT, but includes explicit patent defense and trademark clauses preventing others from using the "Boomerr" brand.
   - *Risks:* Still allows competitors to host proprietary SaaS versions without sharing code.

3. **GNU AGPLv3 (Affero General Public License):**
   - *Pros:* Designed specifically for network and cloud software. If anyone modifies Boomerr and runs it as a hosted service accessible over a network, **they are legally required to release the complete source code of their modifications under AGPLv3**. This prevents predatory SaaS cloning while allowing community self-hosting for internal enterprise use.
   - *Risks:* Some large enterprises have blanket internal policies against AGPL (though internal use without external service provision is fully compliant).

### 3.3 Strategic Recommendation

> [!IMPORTANT]
> **Recommended License: GNU AGPLv3 (Affero General Public License)**
> 
> **Why:** Boomerr is a SaaS product. If released under MIT, an external agency or competitor can immediately deploy a competing commercial uptime service with zero development cost. AGPLv3 protects the project's intellectual property by enforcing that any commercial or cloud operator modifying the code must contribute their changes back to the open-source community. If the project owner wishes to offer commercial enterprise dual-licensing in the future (similar to Grafana, Mattermost, or Plausible), AGPLv3 is the ideal foundation.
> 
> *Note: Per project guidelines, no license file will be committed until explicitly approved by the project owner.*
