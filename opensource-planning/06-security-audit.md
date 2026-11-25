# Comprehensive Security Audit & Hardening Plan

## 1. Executive Security Assessment

Before publishing the Boomerr repository to the public open-source community, a thorough security audit was conducted. Several architectural and implementation-level security concerns were identified, ranging from **Critical** (Server-Side Request Forgery) to **Medium** (Unauthenticated debug routes and credential leakage risks).

None of these issues are structural blockers, but all require remediation before making the repository public.

---

## 2. Identified Security Vulnerabilities & Risks

### 2.1 [CRITICAL] Server-Side Request Forgery (SSRF) in Public Tools & Monitoring
- **Locations:**
  - `backend/app/Http/Controllers/Tools/UptimeCheckerController.php` (Line 27, `performUptimeCheck()`)
  - `backend/app/Http/Controllers/Tools/AdLandingPageCheckerController.php` (Line 61, `performAdLandingPageCheck()`)
  - `backend/app/Http/Controllers/Tools/ShopifyDetectorController.php` (Line 42)
  - `backend/app/Services/DomainHealthService.php` (Line 102, `runUptimeCheck()`)
- **Vulnerability Mechanism:**
  These controllers take user-supplied URLs and initiate HTTP/cURL requests from the server with `CURLOPT_FOLLOWLOCATION = true` without validating the resolved IP address.
  ```php
  // Vulnerable pattern in UptimeCheckerController:
  $ch = curl_init($url);
  curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
  curl_exec($ch);
  ```
- **Exploitation Impact:**
  1. **Cloud Metadata Access:** An attacker can submit `http://169.254.169.254/latest/meta-data/` to extract IAM instance credentials if deployed on AWS, GCP, or Azure.
  2. **Internal Network Scanning:** In a Dockerized deployment, an attacker can submit `http://db:3306`, `http://redis:6379`, or `http://127.0.0.1:8000/api/admin` to probe internal services that are not exposed to the public internet.
  3. **DNS Rebinding:** An attacker can register a domain that resolves to a public IP on first check and rebinds to `127.0.0.1` on subsequent requests.

- **Remediation Plan:**
  Implement a centralized `SafeUrlValidator` utility that:
  - Resolves hostnames to IP addresses before making requests.
  - Rejects private, reserved, loopback, and link-local IP ranges (RFC 1918, RFC 3927, RFC 6890):
    - `127.0.0.0/8` (Loopback)
    - `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` (Private Intranets)
    - `169.254.0.0/16` (Link-local / Cloud Metadata)
    - `0.0.0.0/8`, `::1` (IPv6 loopback)
  - Enforces schemes strictly to `http` or `https` (rejecting `file://`, `gopher://`, `ftp://`).

```php
// Proposed Solution: app/Helpers/SecurityHelper.php
public static function isSafeUrl(string $url): bool
{
    $parts = parse_url($url);
    if (!isset($parts['host']) || !in_array(strtolower($parts['scheme'] ?? ''), ['http', 'https'], true)) {
        return false;
    }

    $ips = dns_get_record($parts['host'], DNS_A + DNS_AAAA);
    if (empty($ips)) {
        return false;
    }

    foreach ($ips as $record) {
        $ip = $record['ip'] ?? $record['ipv6'] ?? null;
        if (!$ip || !filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
            return false; // Blocks private IPs, loopback, and cloud metadata
        }
    }

    return true;
}
```

---

### 2.2 [HIGH] Information Disclosure via Exception Reporting to Remote Webhook
- **Location:** `backend/bootstrap/app.php` (Lines 82–112)
- **Vulnerability Mechanism:**
  The global exception handler intercepts unhandled exceptions and automatically dispatches an HTTP POST payload to a Discord webhook:
  ```php
  $webhookUrl = config('services.discord.webhook_url');
  if ($webhookUrl) {
      $message = "🚨 **System Exception Detected** 🚨\n"
          . "**Message:** " . $e->getMessage() . "\n"
          . "**File:** " . $e->getFile() . " (Line: " . $e->getLine() . ")";
      Http::post($webhookUrl, ['content' => substr($message, 0, 2000)]);
  }
  ```
- **Exploitation Impact:**
  If a self-hoster inadvertently leaves `DISCORD_WEBHOOK_URL` pointing to an old company Discord channel or misconfigures it, full database errors, SQL queries with parameters, and internal filesystem paths will be transmitted to an external party.
- **Remediation Plan:**
  Remove the global Discord exception reporting snippet from `bootstrap/app.php`. Rely on standard Laravel logging channels (`storage/logs/laravel.log`) or standard Sentry integrations.

---

### 2.3 [HIGH] Hardcoded S3 Region & Client Crash on Non-AWS Environments
- **Location:** `backend/app/Services/IncidentRecorderService.php` (Line 72)
- **Vulnerability Mechanism:**
  Direct instantiation of `Aws\S3\S3Client` with hardcoded `'region' => 'ap-south-1'`:
  ```php
  $s3Client = new S3Client([
      'region' => 'ap-south-1',
      'version' => 'latest',
      'credentials' => [
          'key'    => config('filesystems.disks.s3.key'),
          'secret' => config('filesystems.disks.s3.secret')
      ]
  ]);
  ```
- **Exploitation Impact:**
  In self-hosted environments without AWS credentials, incident enrichment throws an unhandled fatal error, terminating background queue jobs and corrupting incident logs.
- **Remediation Plan:**
  Replace direct AWS SDK calls with Laravel's unified storage abstraction:
  `Storage::disk(config('filesystems.default'))->put($filename, $contents);`
  Support local storage disk out of the box.

---

### 2.4 [MEDIUM] Active Debug Routes in Production API
- **Location:** `backend/routes/api.php` (Lines 390–410)
- **Vulnerability Mechanism:**
  Two unauthenticated debug routes are active:
  ```php
  Route::post('/_debug/log-test', function (Request $request) { ... });
  Route::post('/_debug/sms-test', function (Request $request) {
      $phone = $request->input('phone', '+911234567890');
      $message = $request->input('message', 'Test SMS from monitoring system');
      \App\Jobs\SendSmsAlertJob::dispatch($phone, $message);
      return response()->json(['ok' => true]);
  });
  ```
- **Exploitation Impact:**
  Anyone can trigger the `/_debug/sms-test` endpoint without authentication, allowing attackers to spam arbitrary phone numbers and drain the server owner's SMS balance (Twilio/MSG91).
- **Remediation Plan:**
  Delete both debug endpoints immediately.

---

### 2.5 [MEDIUM] Hardcoded Captcha Requirement Blocking Self-Hosted Logins
- **Location:**
  - `backend/app/Http/Controllers/Admin/AuthController.php` (Line 42)
  - `backend/app/Http/Controllers/Auth/AuthController.php` (Line 390)
- **Vulnerability Mechanism:**
  Validation rules require `captcha_token => 'required|string'`, causing logins and password resets to fail with HTTP 422 if hCaptcha is not configured or fails to load.
- **Remediation Plan:**
  Make captcha validation conditional:
  ```php
  $captchaRule = !empty(config('services.hcaptcha.secret')) ? ['required', 'string'] : ['nullable'];
  $request->validate([
      'email' => ['required', 'email'],
      'captcha_token' => $captchaRule,
  ]);
  ```

---

### 2.6 [LOW] Ad-Hoc Scripts in Repository Root
- **Location:** `repair_db.php`, `backend/test_update.php`, `backend/scaffold_*.php`
- **Risk:** These files contain hardcoded database lookups, bypass authentication middleware, and could be executed directly if exposed by misconfigured web servers.
- **Remediation Plan:** Remove all 12 ad-hoc development scripts from git before publishing.

---

## 3. Secret Management & Sanitization Checklist

Before pushing to a public repository:

- [ ] Confirm `backend/.env` is completely removed from Git history (check `git log -p backend/.env`).
- [ ] Confirm `frontend/.env` is completely removed from Git history.
- [ ] Create sanitized `.env.example` with empty secrets and clear instructions.
- [ ] Verify that no API keys or access tokens are hardcoded in seeder files (`DemoDataSeeder.php`, `RolesSeeder.php`).
- [ ] Rotate all production API keys (DeepSeek, AWS, Meta Ads, Google Ads, Razorpay, Telegram, Twilio, MSG91) that were ever present in any commit.
- [ ] Add `.env`, `*.sqlite`, `.phpunit.result.cache`, and `storage/*.png` to `.gitignore`.
