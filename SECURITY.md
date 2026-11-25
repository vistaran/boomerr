# Security Policy

The Boomerr team and community take the security of self-hosted monitoring infrastructure seriously. We appreciate your efforts to responsibly disclose vulnerabilities to help us keep all installations secure.

---

## Supported Versions

Security updates and critical patches are provided for the following versions:

| Version | Supported |
|---|---|
| Latest Release (main) | :white_check_mark: Yes |
| Previous Minor Release | :white_check_mark: Yes |
| Older Versions | :x: No |

---

## Reporting a Vulnerability

**Please do NOT report security vulnerabilities via public GitHub issues, discussions, or social media.**

If you discover a security vulnerability in Boomerr, please report it privately:

1. **Email:** Send details to `security@boomerr.org` (or contact the repository maintainers via GitHub Private Vulnerability Reporting).
2. **Provide Details:**
   * Detailed description of the vulnerability and its potential impact.
   * Step-by-step reproduction instructions or a minimal Proof of Concept (PoC).
   * Affected components (e.g. API endpoint, background worker, Docker configuration).
   * Suggested remediation steps, if known.

### Response Timeline
* **Initial Acknowledgment:** Within 48 hours of report receipt.
* **Assessment & Triaging:** Within 5 business days.
* **Fix & Release:** We will coordinate a patched release and publish a security advisory acknowledging your contribution (unless you prefer to remain anonymous).

---

## Security Best Practices for Self-Hosters

To ensure maximum security when running Boomerr in production:

1. **Always Use HTTPS:** Terminate SSL/TLS via a reverse proxy (such as Caddy, Nginx, or Traefik) and ensure all HTTP traffic redirects to HTTPS.
2. **Never Expose Internal Databases:** Ensure ports `3306` (MariaDB) and `6379` (Redis) are NOT exposed publicly on your host firewall. Only expose port `8080` (or `80`/`443` via reverse proxy).
3. **Rotate Application Secrets:** Ensure `APP_KEY`, `DB_PASSWORD`, and `REVERB_APP_SECRET` in `.env` are generated with high entropy and kept confidential.
4. **Enable Bot Protection:** If public registration is enabled, configure `HCAPTCHA_SITE_KEY` and `HCAPTCHA_SECRET_KEY`.
5. **Keep Containers Updated:** Regularly pull updated container images and review release notes for security patches.
