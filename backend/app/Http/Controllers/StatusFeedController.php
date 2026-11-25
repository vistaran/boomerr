<?php

namespace App\Http\Controllers;

use App\Models\BoomerrIncident;
use App\Models\StatusSubscription;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class StatusFeedController extends Controller
{
  /**
   * GET /api/status/feed.xml
   * Returns an RSS 2.0 feed of Boomerr platform incidents.
   */
  public function rss(): Response
  {
    $incidents = BoomerrIncident::orderByDesc('incident_started_at')->take(20)->get();

    $items = '';
    foreach ($incidents as $incident) {
      $title = e($incident->incident_title);
      $status = ucfirst($incident->incident_status);
      $link = 'https://boomerr.ai/status';
      $description = e($incident->incident_impact ?? 'Boomerr platform incident.');
      $pubDate = $incident->incident_started_at->toRssString();
      $guid = 'boomerr-incident-' . $incident->id;

      $items .= <<<XML

    <item>
      <title>{$title} - {$status}</title>
      <link>{$link}</link>
      <description>{$description}</description>
      <pubDate>{$pubDate}</pubDate>
      <guid isPermaLink="false">{$guid}</guid>
    </item>
XML;
    }

    $buildDate = now()->toRssString();
    $baseUrl = config('app.url', 'https://api.boomerr.ai');
    $xml = <<<XML
<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="{$baseUrl}/rss-style.xsl"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Boomerr System Status</title>
    <link>https://boomerr.ai/status</link>
    <description>Real-time operational status of Boomerr's global monitoring infrastructure.</description>
    <language>en-us</language>
    <lastBuildDate>{$buildDate}</lastBuildDate>
    <atom:link href="https://boomerr.ai/api/status/feed.xml" rel="self" type="application/rss+xml"/>
    {$items}
  </channel>
</rss>
XML;

    return response($xml, 200, ['Content-Type' => 'application/rss+xml; charset=utf-8']);
  }
}
