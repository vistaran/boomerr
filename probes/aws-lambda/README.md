# Boomerr AWS Lambda Edge Probe

Deploy serverless edge monitoring probes across AWS regions (e.g. `ap-south-1`, `us-east-1`, `us-west-2`, `eu-central-1`, `af-south-1`, `me-south-1`).

## 🚀 Quick Deploy with AWS SAM

```bash
# In each AWS region you want to monitor from:
sam deploy --guided \
  --region us-east-1 \
  --parameter-overrides BoomerrServerUrl="https://your-boomerr-server.com" BoomerrApiKey="your_monitoring_api_key"
```

## ⚙️ Enabling Lambda in Central Boomerr `.env`

In your central Boomerr instance `.env`:

```env
MONITORING_LAMBDA_ENABLED=true
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
MONITORING_API_KEY=your_monitoring_api_key
```

When enabled, the central scheduler will asynchronously invoke `boomerr-monitor` in each active AWS region for multi-region domains.
