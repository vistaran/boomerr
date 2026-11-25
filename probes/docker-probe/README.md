# Boomerr Docker Edge Probe

A lightweight (<40MB), zero-dependency edge probe agent for Boomerr. Deploy this probe onto any VPS, bare-metal server, or branch office to enable global multi-region website monitoring.

## 🚀 Quick Start (1 Command)

Run on any remote server:

```bash
docker run -d --name boomerr-probe --restart unless-stopped \
  -e BOOMERR_SERVER_URL="https://your-boomerr-domain.com" \
  -e BOOMERR_API_KEY="your_secure_shared_api_key" \
  -e PROBE_REGION="eu-central-1" \
  -e PROBE_LOCATION="Frankfurt (Germany)" \
  boomerr-probe:latest
```

## ⚙️ Environment Variables

| Variable | Description | Default |
|---|---|---|
| `BOOMERR_SERVER_URL` | Base URL of your central Boomerr instance | `http://localhost:8080` |
| `BOOMERR_API_KEY` | Shared API key (`MONITORING_API_KEY` in Boomerr `.env`) | Required |
| `PROBE_REGION` | Regional code matching `monitoring_regions` table (e.g. `us-east-1`, `eu-central-1`) | `eu-central-1` |
| `PROBE_LOCATION` | Human-readable city/region name | `Frankfurt (Germany)` |
| `PROBE_INTERVAL` | Seconds between check cycles | `30` |
| `PROBE_TIMEOUT` | Seconds before timing out an individual target probe | `10` |

## 🛠️ Build Locally

```bash
docker build -t boomerr-probe:local .
```
