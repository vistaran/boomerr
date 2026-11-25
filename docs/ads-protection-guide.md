# Ads Protection Guide (Google Ads & Meta Ads)

Boomerr includes an integrated **Ads Protection Engine** designed for digital marketers, agencies, and e-commerce stores. When an advertising landing page goes down, ongoing campaigns can burn hundreds or thousands of dollars sending paid clicks to a 404 or 500 error page.

Boomerr continuously monitors landing pages and automatically:
1. **Pauses active Google Ads campaigns and Meta (Facebook) ads** the second downtime is detected.
2. **Resumes those campaigns automatically** the moment your website recovers and passes health checks.

---

## 1. How It Works

```
                                [ Website Status Check ]
                                           │
                    ┌──────────────────────┴──────────────────────┐
                    ▼                                             ▼
             [ Status: DOWN ]                              [ Status: UP ]
                    │                                             │
      DomainStatusUpdated Event                     DomainStatusUpdated Event
                    │                                             │
      ┌─────────────┴─────────────┐                 ┌─────────────┴─────────────┐
      ▼                           ▼                 ▼                           ▼
[ Google Ads Listener ]   [ Meta Ads Listener ]   [ Google Ads Listener ]   [ Meta Ads Listener ]
      │                           │                 │                           │
Pause Assigned Campaigns    Pause Assigned Ads    Resume Paused Campaigns   Resume Paused Ads
```

* **Zero Latency:** Pausing is handled asynchronously via high-priority background Redis queues (`HandleDomainStatusForGoogleAds` and `HandleDomainStatusForFacebookAds`).
* **State Safety:** Only campaigns and ads that were active prior to the outage are resumed. Campaigns you manually paused will remain paused.

---

## 2. Google Ads Integration

### Prerequisites:
1. A Google Cloud Platform (GCP) project with the **Google Ads API** enabled.
2. OAuth 2.0 Client ID and Secret configured in GCP.
3. A Google Ads Developer Token.

### Environment Configuration:
Add the following to your `.env` file:

```ini
GOOGLE_ADS_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_ADS_CLIENT_SECRET=your-google-client-secret
GOOGLE_ADS_DEVELOPER_TOKEN=your-google-ads-developer-token
GOOGLE_ADS_REDIRECT_URI="http://localhost:8080/integrations/google/callback"
```

### Setup in Boomerr:
1. Navigate to **Integrations** in your Boomerr dashboard.
2. Click **Connect Google Ads**.
3. Grant permissions via the Google OAuth consent screen.
4. Go to any monitored domain, open the **Integrations** tab, and assign the target Google Ads campaigns to that domain.

---

## 3. Meta (Facebook) Ads Integration

### Prerequisites:
1. A Meta for Developers App with **Marketing API** permissions.
2. App ID and App Secret.

### Environment Configuration:
Add the following to your `.env` file:

```ini
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret
FACEBOOK_REDIRECT_URI="http://localhost:8080/integrations/facebook/callback"
```

### Setup in Boomerr:
1. Navigate to **Integrations** &rarr; **Facebook Ads**.
2. Authenticate with Facebook and select the Ad Accounts you want to link.
3. Go to your domain settings and select the specific Ad Sets or Ads to protect.

---

## 4. Manual Pause & Resume Controls

In addition to automatic triggers during downtime, Boomerr provides direct manual controls in the dashboard:
* **Instant Emergency Pause:** Pause all campaigns assigned to a domain with a single click (useful during scheduled site maintenance).
* **Instant Bulk Resume:** Resume all campaigns once maintenance is complete.
