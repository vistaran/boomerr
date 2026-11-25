@php
    $isCreated = $action === 'created';
    $isUpdated = $action === 'updated';
    $isDeleted = $action === 'deleted';
    $safeUrl = $url ?: '#';
@endphp
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="color-scheme" content="light dark" />
    <meta name="supported-color-schemes" content="light dark" />
    <title>{{ $title ?? 'Domain Change - Boomerr Monitoring' }}</title>

    <style>
        :root {
            color-scheme: light dark;
            supported-color-schemes: light dark;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            padding: 24px 12px;
            background: #f8fafc;
            line-height: 1.6;
            color: #0f172a;
        }

        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01);
            border: 1px solid #f1f5f9;
        }

        /* ---------- HEADER ---------- */

        .header {
            background-color: #ffffff !important;
            color: #0f172a !important;
            padding: 32px 24px;
            text-align: center;
            position: relative;
            border-bottom: 1px solid #e2e8f0;
        }

        .header-brand {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            margin-bottom: 16px;
        }

        .header-brand h2 {
            font-size: 20px;
            font-weight: 700;
            color: #0f172a !important;
            -webkit-text-fill-color: #0f172a !important;
            letter-spacing: -0.5px;
            display: inline-block;
            margin: 0;
        }

        .header-badge {
            display: inline-block;
            padding: 4px 14px;
            border-radius: 9999px;
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 12px;
        }

        .badge-created {
            background: #ecfdf5;
            color: #10b981;
            border: 1px solid #a7f3d0;
        }

        .badge-deleted {
            background: #fff1f2;
            color: #f43f5e;
            border: 1px solid #fecdd3;
        }

        .badge-updated {
            background: #f0f9ff;
            color: #0ea5e9;
            border: 1px solid #bae6fd;
        }

        .header h1 {
            font-size: 24px;
            font-weight: 700;
            color: #0f172a !important;
            -webkit-text-fill-color: #0f172a !important;
            letter-spacing: -0.5px;
            margin-bottom: 8px;
            line-height: 1.3;
        }

        .header p {
            font-size: 14px;
            color: #64748b !important;
            -webkit-text-fill-color: #64748b !important;
            max-width: 480px;
            margin: 0 auto;
            line-height: 1.5;
        }

        [data-ogsc] .header h1,
        [data-ogsc] .header h2,
        [data-ogsc] .header p,
        [data-ogsc] .header-brand h2 {
            color: #0f172a !important;
            -webkit-text-fill-color: #0f172a !important;
        }

        @media (prefers-color-scheme: dark) {
            .header {
                background-color: #ffffff !important;
            }
            .header h1,
            .header h2,
            .header-brand h2 {
                color: #0f172a !important;
                -webkit-text-fill-color: #0f172a !important;
            }
            .header p {
                color: #64748b !important;
                -webkit-text-fill-color: #64748b !important;
            }
        }

        /* ---------- CONTENT ---------- */

        .content {
            padding: 36px 28px;
            color: #1e293b;
        }

        .greeting {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 12px;
            color: #0f172a;
        }

        .message {
            font-size: 15px;
            color: #475569;
            margin-bottom: 20px;
            line-height: 1.6;
        }

        /* ---------- DOMAIN CARD ---------- */

        .domain-card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 18px;
            margin: 20px 0;
        }

        .domain-name {
            font-size: 16px;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 8px;
            word-break: break-all;
        }

        .domain-url {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 10px 14px;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 13px;
            word-break: break-all;
        }

        .domain-url a {
            color: #2563eb;
            text-decoration: none;
            font-weight: 500;
        }

        /* ---------- INFO ---------- */

        .info-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            background: #f8fafc;
            border-radius: 10px;
            overflow: hidden;
            border: 1px solid #e2e8f0;
        }

        .info-table td {
            padding: 10px 16px;
            font-size: 13px;
            border-bottom: 1px solid #edf2f7;
        }

        .info-table tr:last-child td {
            border-bottom: none;
        }

        .info-label {
            font-weight: 600;
            color: #64748b;
            width: 35%;
        }

        .info-value {
            color: #0f172a;
            font-weight: 500;
        }

        /* ---------- CHANGES ---------- */

        .changes-section {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            padding: 16px 18px;
            border-radius: 12px;
            margin: 20px 0;
        }

        .changes-section-title {
            font-size: 14px;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 12px;
        }

        .change-row {
            display: flex;
            align-items: center;
            margin-bottom: 8px;
            font-size: 13px;
            color: #1e293b;
            flex-wrap: wrap;
            gap: 6px;
        }

        .change-field {
            min-width: 90px;
            font-weight: 600;
            color: #475569;
        }

        .change-before,
        .change-after {
            background: #f1f5f9;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 4px 8px;
            font-size: 12px;
            color: #0f172a;
        }

        .change-arrow {
            color: #94a3b8;
            font-weight: 700;
        }

        /* ---------- CTA ---------- */

        .cta-container {
            text-align: center;
            margin: 28px 0 10px;
        }

        .cta-button {
            display: inline-block;
            padding: 14px 28px;
            background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
            color: #ffffff !important;
            text-decoration: none;
            font-weight: 600;
            font-size: 15px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
            text-align: center;
        }

        /* ---------- FOOTER ---------- */

        .footer {
            background: #f8fafc;
            padding: 28px 24px;
            text-align: center;
            border-top: 1px solid #e2e8f0;
        }

        .footer-logo {
            font-size: 20px;
            font-weight: 700;
            color: #2563eb;
            margin-bottom: 6px;
            letter-spacing: -0.5px;
        }

        .footer p {
            font-size: 13px;
            color: #64748b;
            margin: 6px 0;
        }

        .footer-links {
            margin-top: 12px;
        }

        .footer-links a {
            font-size: 13px;
            color: #2563eb;
            text-decoration: none;
            margin: 0 10px;
            font-weight: 500;
        }

        @media (max-width: 600px) {
            .content {
                padding: 24px 16px;
            }

            .cta-button {
                display: block;
                text-align: center;
            }
        }
    </style>
</head>

<body>
    <div class="email-container">

        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#ffffff" style="background-color: #ffffff; border-radius: 16px 16px 0 0; width: 100%; border-collapse: collapse; border-bottom: 1px solid #e2e8f0;">
            <tr>
                <td align="center" bgcolor="#ffffff" style="background-color: #ffffff; padding: 32px 24px; text-align: center; color: #0f172a !important;">
                    <div class="header-brand" style="margin-bottom: 16px; text-align: center;">
                        <h2 style="font-size: 20px; font-weight: 700; color: #0f172a !important; -webkit-text-fill-color: #0f172a !important; letter-spacing: -0.5px; margin: 0; display: inline-block;">
                            <font color="#0f172a">Boomerr</font>
                        </h2>
                    </div>
                    <div style="margin-bottom: 12px; text-align: center;">
                        @if ($isCreated)
                            <span class="header-badge badge-created" style="display: inline-block; padding: 4px 14px; border-radius: 9999px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; background-color: #ecfdf5; color: #10b981; border: 1px solid #a7f3d0;"><font color="#10b981">Added</font></span>
                        @elseif ($isDeleted)
                            <span class="header-badge badge-deleted" style="display: inline-block; padding: 4px 14px; border-radius: 9999px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; background-color: #fff1f2; color: #f43f5e; border: 1px solid #fecdd3;"><font color="#f43f5e">Deleted</font></span>
                        @else
                            <span class="header-badge badge-updated" style="display: inline-block; padding: 4px 14px; border-radius: 9999px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; background-color: #f0f9ff; color: #0ea5e9; border: 1px solid #bae6fd;"><font color="#0ea5e9">Updated</font></span>
                        @endif
                    </div>
                    <h1 style="font-size: 24px; font-weight: 700; color: #0f172a !important; -webkit-text-fill-color: #0f172a !important; letter-spacing: -0.5px; margin: 0 0 8px; line-height: 1.3;">
                        <font color="#0f172a">
                            @if ($isCreated)
                                Domain Added!
                            @elseif ($isDeleted)
                                Domain Deleted!
                            @else
                                Domain Updated!
                            @endif
                        </font>
                    </h1>
                    <p style="font-size: 14px; color: #64748b !important; -webkit-text-fill-color: #64748b !important; max-width: 480px; margin: 0 auto; line-height: 1.5;">
                        <font color="#64748b">
                            {{ $title ?? 'A change was made to your monitored domain.' }}
                        </font>
                    </p>
                </td>
            </tr>
        </table>

        <div class="content">
            <p class="greeting">Hello 👋</p>

            <p class="message">{{ $summary ?? 'A change was made to your monitored domain.' }}</p>

            <div class="domain-card">
                <div class="domain-name">{{ $domain['name'] ?? 'N/A' }}</div>
                <div class="domain-url">
                    <a href="{{ $safeUrl }}" target="_blank">{{ $url }}</a>
                </div>
            </div>

            <table class="info-table">
                <tr>
                    <td class="info-label">Status</td>
                    <td class="info-value">
                        @if ($isCreated)
                            <span style="color: #10b981; font-weight: 600;">● Added</span>
                        @elseif ($isDeleted)
                            <span style="color: #f43f5e; font-weight: 600;">● Deleted</span>
                        @else
                            <span style="color: #0ea5e9; font-weight: 600;">● Updated</span>
                        @endif
                    </td>
                </tr>
                <tr>
                    <td class="info-label">Environment</td>
                    <td class="info-value" style="text-transform: capitalize;">{{ $environment }}</td>
                </tr>
                <tr>
                    <td class="info-label">Changed By</td>
                    <td class="info-value">{{ $actor }}</td>
                </tr>
                <tr>
                    <td class="info-label">Timestamp</td>
                    <td class="info-value">{{ $timestamp }}</td>
                </tr>
            </table>

            @if (!empty($changes))
                <div class="changes-section">
                    <div class="changes-section-title">Changes Made</div>
                    @foreach ($changes as $change)
                        <div class="change-row">
                            <span class="change-field">{{ $change['field'] }}</span>
                            <span class="change-before">
                                {{ \App\Notifications\DomainChangedNotification::stringify($change['before']) }}
                            </span>
                            <span class="change-arrow">→</span>
                            <span class="change-after">
                                {{ \App\Notifications\DomainChangedNotification::stringify($change['after']) }}
                            </span>
                        </div>
                    @endforeach
                </div>
            @endif

            <div class="cta-container">
                <a href="{{ $safeUrl }}" class="cta-button" target="_blank">View Domain →</a>
            </div>
        </div>

        <div class="footer">
            <div class="footer-logo">Boomerr</div>
            <p>Reliable domain monitoring & uptime tracking</p>
            <div class="footer-links">
                <a href="{{ config('app.frontend_url') }}/overview">Dashboard</a>
                <a href="{{ config('app.frontend_url') }}/support">Support</a>
                <a href="{{ config('app.frontend_url') }}/settings">Settings</a>
            </div>
            <p style="margin-top: 14px; font-size: 12px; color: #94a3b8;">© {{ date('Y') }} Boomerr. All rights reserved.</p>
        </div>

    </div>
</body>

</html>
