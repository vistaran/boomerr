# Boomerr Troubleshooting & FAQ

This document covers common operational issues, diagnostics, and step-by-step solutions for self-hosted Boomerr instances.

---

## 1. Quick Diagnostic: Run the Doctor Command

Before debugging individual services, run the built-in diagnostic doctor:

```bash
docker compose exec api php artisan boomerr:doctor
```

This tests:
- App key configuration
- Database connectivity and table counts
- Redis ping response
- Directory write permissions for `storage/` and `bootstrap/cache/`
- Real-time WebSocket credentials
- Optional integrations (Mail, hCaptcha, AI)

---

## 2. Common Issues & Solutions

### Issue 1: "APP_KEY is missing or empty" on container startup
**Symptoms:** The `api`, `worker`, or `reverb` containers fail to start and print:
`[FATAL ERROR] APP_KEY is missing or empty.`

**Cause:** Boomerr requires a shared 32-byte base64 encryption key in `.env` to prevent credential decryption mismatches across containers.

**Solution:**
1. Generate an encryption key:
   ```bash
   php -r "echo 'base64:'.base64_encode(random_bytes(32)).PHP_EOL;"
   # or
   openssl rand -base64 32
   ```
2. Add it to your `.env` file:
   ```env
   APP_KEY=base64:YOUR_GENERATED_KEY_HERE
   ```
3. Restart containers:
   ```bash
   docker compose up -d
   ```

---

### Issue 2: Real-time WebSockets fail or disconnect in the browser
**Symptoms:** Status updates don't appear live; browser console shows `WebSocket connection to 'ws://.../app/...' failed`.

**Cause:** Nginx or host reverse proxy is not passing the `Upgrade` headers, or `REVERB_HOST`/`REVERB_PORT` points to an unreachable host.

**Solution:**
1. Verify `REVERB_HOST` in `.env` matches the domain name or IP you are using in your browser (e.g. `REVERB_HOST=status.yourdomain.com`).
2. If your site uses HTTPS, set:
   ```env
   REVERB_SCHEME=https
   REVERB_PORT=443
   ```
3. Ensure your host reverse proxy (Caddy / Nginx) includes WebSocket upgrade headers:
   ```nginx
   proxy_http_version 1.1;
   proxy_set_header Upgrade $http_upgrade;
   proxy_set_header Connection "upgrade";
   ```

---

### Issue 3: "Connection refused" to MariaDB database
**Symptoms:** `SQLSTATE[HY000] [2002] Connection refused` in logs.

**Cause:** The `api` container attempted to query MariaDB before the database server finished its initial startup.

**Solution:**
1. Check database container status:
   ```bash
   docker compose logs db
   ```
2. Verify that `DB_HOST=db` in `.env` (do NOT use `127.0.0.1` inside Docker containers).
3. If MariaDB is still initializing for the first time, wait 30 seconds and run migrations:
   ```bash
   docker compose exec api php artisan migrate --force
   ```

---

### Issue 4: Permission Denied on `storage/` or `bootstrap/cache/`
**Symptoms:** `The stream or file ".../storage/logs/laravel.log" could not be opened: Permission denied`.

**Cause:** Host file permissions differ from container `www-data` (UID 82 on Alpine / UID 33 on Debian).

**Solution:**
Fix file ownership from inside the container:
```bash
docker compose exec -u root api chown -R www-data:www-data /var/www/html/backend/storage /var/www/html/backend/bootstrap/cache
docker compose exec -u root api chmod -R 775 /var/www/html/backend/storage /var/www/html/backend/bootstrap/cache
```

---

### Issue 5: How to create or reset an Administrator Account
If you lost your admin password or need to create an additional administrative user:

```bash
docker compose exec api php artisan boomerr:admin:create
```

You will be prompted for:
1. Admin Name
2. Admin Email
3. Admin Password (min 8 characters)

Existing accounts with the same email will have their password securely updated.

---

### Issue 6: Background Monitoring Queue is Not Running
**Symptoms:** Monitor checks are scheduled but their status remains "Pending" and never updates.

**Cause:** The queue worker container is stopped or paused.

**Solution:**
1. Check worker container status:
   ```bash
   docker compose ps worker
   ```
2. Inspect worker logs:
   ```bash
   docker compose logs -f worker
   ```
3. Restart worker:
   ```bash
   docker compose restart worker
   ```
4. Verify Redis is running:
   ```bash
   docker compose exec redis redis-cli ping
   # Expected output: PONG
   ```

---

### Issue 7: Clear Application & Route Caches
If you changed `.env` values and they aren't taking effect:

```bash
docker compose exec api php artisan config:clear
docker compose exec api php artisan route:clear
docker compose exec api php artisan cache:clear
```
