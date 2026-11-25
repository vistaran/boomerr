# Boomerr Backup & Disaster Recovery Guide

Boomerr includes automated scripts in the `scripts/` directory to create compressed, checksummed backups and restore them cleanly on fresh servers.

---

## 1. What Gets Backed Up

A complete Boomerr backup includes:
1. **MariaDB Database Dump:** Full SQL export of all tables (monitors, workspaces, users, incident logs, status page settings).
2. **Uploaded Assets & Screenshots:** Everything in `backend/storage/app/public/` (incident screenshots, avatars, favicon caches).
3. **Environment Settings:** `.env` configuration file containing application keys and integration tokens.
4. **SHA256 Checksum:** Cryptographic verification manifest ensuring archive integrity.

---

## 2. Taking a Manual Backup

Run the backup script from the repository root:

```bash
chmod +x scripts/backup.sh
./scripts/backup.sh
```

By default, backups are saved in the `backups/` directory:
```
backups/
└── boomerr_backup_20261123_120000.tar.gz
```

You can optionally specify a custom destination path (e.g. an external mount or NFS share):
```bash
./scripts/backup.sh /mnt/secure-backups/boomerr
```

---

## 3. Restoring from a Backup

To restore Boomerr on the current server or a completely new server:

### Step 1: Ensure Containers are Running
```bash
docker compose up -d
```

### Step 2: Execute Restore Script
```bash
chmod +x scripts/restore.sh
./scripts/restore.sh backups/boomerr_backup_20261123_120000.tar.gz
```

The restore script:
1. Verifies the SHA256 archive checksum.
2. Imports the MariaDB database dump into the `db` container.
3. Restores uploaded media into `backend/storage/app/public/`.
4. Fixes file permissions for the web server (`www-data`).
5. Runs schema migrations and clears compiled route/config caches.

---

## 4. Automating Daily Backups via Cron

To set up automatic daily backups at 02:00 AM:

1. Open crontab:
   ```bash
   crontab -e
   ```
2. Add the following entry (adjusting the path to your Boomerr directory):
   ```cron
   0 2 * * * cd /opt/boomerr && ./scripts/backup.sh /var/backups/boomerr >> /var/log/boomerr-backup.log 2>&1
   ```
3. To automatically prune backups older than 14 days, add a rotation line:
   ```cron
   30 2 * * * find /var/backups/boomerr/ -name "boomerr_backup_*.tar.gz" -mtime +14 -delete
   ```
