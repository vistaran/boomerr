<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="html" encoding="UTF-8" indent="yes" />

  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Boomerr Status - RSS Feed</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&amp;display=swap');

          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

          body {
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            background: #030712;
            color: #cbd5e1;
            min-height: 100vh;
            padding: 0 0 80px;
          }

          /* Top accent line */
          body::before {
            content: '';
            display: block;
            height: 2px;
            background: linear-gradient(90deg, transparent, #3b82f6 30%, #6366f1 70%, transparent);
          }

          /* Background dot grid */
          body::after {
            content: '';
            position: fixed;
            inset: 0;
            background-image: radial-gradient(#1e3a5f 1px, transparent 1px);
            background-size: 28px 28px;
            opacity: 0.25;
            pointer-events: none;
            z-index: 0;
          }

          .wrap {
            position: relative;
            z-index: 1;
            max-width: 820px;
            margin: 0 auto;
            padding: 0 20px;
          }

          /* ── Header ── */
          .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 28px 0 24px;
            border-bottom: 1px solid rgba(255,255,255,0.06);
            gap: 16px;
            flex-wrap: wrap;
          }

          .header-left {
            display: flex;
            align-items: center;
            gap: 14px;
          }

          .rss-icon {
            width: 44px;
            height: 44px;
            background: linear-gradient(135deg, rgba(249,115,22,0.2), rgba(234,88,12,0.1));
            border: 1px solid rgba(249,115,22,0.25);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            box-shadow: 0 0 20px rgba(249,115,22,0.15);
          }

          .header h1 {
            font-size: 18px;
            font-weight: 800;
            color: #f1f5f9;
            letter-spacing: -0.3px;
          }

          .header h1 span { color: #f97316; }

          .header p {
            font-size: 12px;
            color: #475569;
            margin-top: 2px;
          }

          .badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: rgba(249,115,22,0.1);
            border: 1px solid rgba(249,115,22,0.2);
            color: #fb923c;
            font-size: 11px;
            font-weight: 700;
            padding: 5px 12px;
            border-radius: 100px;
            white-space: nowrap;
          }

          .badge-dot {
            width: 7px;
            height: 7px;
            background: #f97316;
            border-radius: 50%;
            box-shadow: 0 0 6px rgba(249,115,22,0.8);
            animation: pulse 2s ease-in-out infinite;
          }

          @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.6; transform: scale(0.85); }
          }

          /* ── Meta strip ── */
          .meta-strip {
            display: flex;
            gap: 20px;
            padding: 16px 0;
            border-bottom: 1px solid rgba(255,255,255,0.04);
            flex-wrap: wrap;
          }

          .meta-item {
            display: flex;
            flex-direction: column;
            gap: 2px;
          }

          .meta-label {
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.12em;
            color: #334155;
          }

          .meta-value {
            font-size: 12px;
            color: #94a3b8;
            font-family: 'Courier New', monospace;
          }

          .meta-value a { color: #60a5fa; text-decoration: none; }
          .meta-value a:hover { color: #93c5fd; }

          /* ── Section title ── */
          .section-title {
            display: flex;
            align-items: center;
            gap: 12px;
            margin: 28px 0 16px;
          }

          .section-title::before {
            content: '';
            width: 3px;
            height: 20px;
            background: linear-gradient(180deg, #f97316, #ef4444);
            border-radius: 99px;
          }

          .section-title h2 {
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.15em;
            color: #64748b;
          }

          .count-badge {
            margin-left: auto;
            background: rgba(255,255,255,0.03);
            border: 1px solid rgba(255,255,255,0.06);
            color: #64748b;
            font-size: 11px;
            font-mono: true;
            padding: 2px 10px;
            border-radius: 100px;
          }

          /* ── Empty state ── */
          .empty {
            text-align: center;
            padding: 60px 20px;
            background: linear-gradient(135deg, rgba(16,185,129,0.04) 0%, rgba(5,11,20,0.7) 100%);
            border: 1px solid rgba(255,255,255,0.05);
            border-radius: 16px;
          }

          .empty-icon {
            font-size: 36px;
            margin-bottom: 14px;
          }

          .empty h3 {
            font-size: 15px;
            font-weight: 700;
            color: #e2e8f0;
            margin-bottom: 6px;
          }

          .empty p {
            font-size: 13px;
            color: #475569;
            line-height: 1.6;
          }

          /* ── Incident card ── */
          .incident {
            background: linear-gradient(135deg, rgba(15,23,42,0.85) 0%, rgba(5,11,20,0.95) 100%);
            border: 1px solid rgba(255,255,255,0.07);
            border-radius: 14px;
            overflow: hidden;
            margin-bottom: 12px;
            position: relative;
          }

          .incident::before {
            content: '';
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            width: 3px;
            background: linear-gradient(180deg, #f97316, #ef4444);
          }

          .incident-header {
            padding: 16px 18px 14px 20px;
            border-bottom: 1px solid rgba(255,255,255,0.05);
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 12px;
          }

          .incident-title {
            font-size: 14px;
            font-weight: 600;
            color: #f1f5f9;
            line-height: 1.4;
          }

          .incident-status {
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.12em;
            padding: 4px 10px;
            border-radius: 100px;
            background: rgba(249,115,22,0.1);
            border: 1px solid rgba(249,115,22,0.2);
            color: #fb923c;
            white-space: nowrap;
            flex-shrink: 0;
          }

          .incident-body {
            padding: 14px 18px 14px 20px;
          }

          .incident-desc {
            font-size: 13px;
            color: #94a3b8;
            line-height: 1.65;
            margin-bottom: 12px;
          }

          .incident-date {
            font-size: 10px;
            font-family: 'Courier New', monospace;
            color: #334155;
          }

          /* ── Footer ── */
          .footer {
            margin-top: 48px;
            padding-top: 20px;
            border-top: 1px solid rgba(255,255,255,0.05);
            text-align: center;
            font-size: 11px;
            color: #334155;
          }

          .footer a { color: #475569; text-decoration: none; }
          .footer a:hover { color: #94a3b8; }
        </style>
      </head>
      <body>
        <div class="wrap">

          <!-- Header -->
          <div class="header">
            <div class="header-left">
              <div class="rss-icon">📡</div>
              <div>
                <h1>Boomerr <span>Status</span> Feed</h1>
                <p><xsl:value-of select="rss/channel/description" /></p>
              </div>
            </div>
            <div class="badge">
              <span class="badge-dot" />
              RSS 2.0 Live Feed
            </div>
          </div>

          <!-- Meta strip -->
          <div class="meta-strip">
            <div class="meta-item">
              <span class="meta-label">Feed URL</span>
              <span class="meta-value">
                <a href="{rss/channel/atom:link/@href}"><xsl:value-of select="rss/channel/atom:link/@href" /></a>
              </span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Last Updated</span>
              <span class="meta-value"><xsl:value-of select="rss/channel/lastBuildDate" /></span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Status Page</span>
              <span class="meta-value">
                <a>
                  <xsl:attribute name="href">
                    <xsl:value-of select="rss/channel/link" />
                  </xsl:attribute>
                  <xsl:value-of select="rss/channel/link" />
                </a>
              </span>
            </div>
          </div>

          <!-- Incidents -->
          <div class="section-title">
            <h2>Recent Incidents</h2>
            <span class="count-badge"><xsl:value-of select="count(rss/channel/item)" /> items</span>
          </div>

          <xsl:choose>
            <xsl:when test="count(rss/channel/item) = 0">
              <div class="empty">
                <div class="empty-icon">✅</div>
                <h3>No incidents reported</h3>
                <p>All Boomerr systems are running normally.<br/>This feed will update automatically when incidents are posted.</p>
              </div>
            </xsl:when>
            <xsl:otherwise>
              <xsl:for-each select="rss/channel/item">
                <div class="incident">
                  <div class="incident-header">
                    <span class="incident-title"><xsl:value-of select="title" /></span>
                    <span class="incident-status">Incident</span>
                  </div>
                  <div class="incident-body">
                    <p class="incident-desc"><xsl:value-of select="description" /></p>
                    <p class="incident-date">Published: <xsl:value-of select="pubDate" /></p>
                  </div>
                </div>
              </xsl:for-each>
            </xsl:otherwise>
          </xsl:choose>

          <!-- Footer -->
          <div class="footer">
            Powered by Boomerr Uptime Monitoring ·
            <a>
              <xsl:attribute name="href">
                <xsl:value-of select="rss/channel/link" />
              </xsl:attribute>
              Status Page
            </a>
          </div>

        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
