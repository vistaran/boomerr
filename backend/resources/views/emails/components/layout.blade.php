@props([
    'title' => 'Boomerr Notification',
    'unsubscribeUrl' => null,
    'bodyBg' => '#f1f5f9',
    'cardBg' => '#ffffff',
    'headerBg' => '#ffffff',
    'footerBg' => '#f8fafc',
    'footerTextColor' => '#64748b',
    'footerContent' => null,
])
@php
    // Keep header background white for all templates as requested
    $effectiveHeaderBg = ($headerBg === '#080e1f' || empty($headerBg)) ? '#ffffff' : $headerBg;
    $isDarkHeader = in_array(strtolower(trim($effectiveHeaderBg)), ['#080e1f', '#0f172a', '#030712', '#1e293b', '#000000', '#111827']);
    $headerTextColor = $isDarkHeader ? '#ffffff' : '#0f172a';
    $headerBorderColor = $isDarkHeader ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0';
@endphp
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>{{ $title ?? 'Boomerr Notification' }}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background-color: {{ $bodyBg ?? '#f1f5f9' }};
            color: #0f172a;
            padding: 32px 12px;
            line-height: 1.6;
            -webkit-text-size-adjust: 100%;
            -ms-text-size-adjust: 100%;
        }

        .email-wrapper {
            width: 100%;
            max-width: 600px;
            margin: 0 auto;
            background-color: {{ $cardBg ?? '#ffffff' }};
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.02);
            border: 1px solid #e2e8f0;
        }

        .header {
            background-color: {{ $effectiveHeaderBg }};
            background: {{ $effectiveHeaderBg }};
            color: {{ $headerTextColor }};
            padding: 28px 24px;
            text-align: center;
            border-bottom: 1px solid {{ $headerBorderColor }};
        }

        .header a {
            color: {{ $headerTextColor }};
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
        }

        .header img {
            vertical-align: middle;
            border: 0;
            outline: none;
        }

        .header h1 {
            font-size: 24px;
            font-weight: 700;
            color: {{ $headerTextColor }};
            margin: 0;
            display: inline-block;
            vertical-align: middle;
            letter-spacing: -0.5px;
        }

        .content {
            padding: 36px 32px;
            color: #1e293b;
            font-size: 15px;
            line-height: 1.65;
        }

        .email-greeting {
            font-size: 18px;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 18px;
            letter-spacing: -0.3px;
        }

        p {
            font-size: 15px;
            color: #334155;
            margin-bottom: 16px;
            text-align: left;
            line-height: 1.65;
        }

        strong {
            color: #0f172a;
            font-weight: 600;
        }

        ul, ol {
            margin: 0 0 20px 20px;
            color: #334155;
            font-size: 15px;
        }

        li {
            margin-bottom: 8px;
            line-height: 1.6;
        }

        .button-wrapper {
            width: 100%;
            margin: 28px auto;
            text-align: center;
        }

        .button {
            display: inline-block;
            padding: 13px 28px;
            background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
            background-color: #2563eb;
            color: #ffffff !important;
            text-decoration: none;
            font-weight: 600;
            font-size: 15px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
            text-align: center;
            letter-spacing: 0.2px;
        }

        .info-card {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 18px 20px;
            margin: 22px 0;
            text-align: left;
        }

        .info-card.success {
            background-color: #f0fdf4;
            border-color: #bbf7d0;
        }

        .info-card.danger {
            background-color: #fef2f2;
            border-color: #fecaca;
        }

        .info-card.warning {
            background-color: #fffbeb;
            border-color: #fde68a;
        }

        .code-pill {
            display: inline-block;
            padding: 6px 14px;
            background-color: #e0e7ff;
            color: #3730a3;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-weight: 700;
            border-radius: 6px;
            letter-spacing: 1.2px;
            font-size: 14px;
            border: 1px dashed #6366f1;
        }

        .spec-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            font-size: 14px;
        }

        .spec-table td {
            padding: 10px 14px;
            border-bottom: 1px solid #f1f5f9;
            text-align: left;
        }

        .spec-label {
            color: #64748b;
            font-weight: 500;
            width: 38%;
        }

        .spec-value {
            color: #0f172a;
            font-weight: 600;
        }

        .signoff {
            margin-top: 28px;
            padding-top: 20px;
            border-top: 1px solid #f1f5f9;
            color: #475569;
            font-size: 14px;
        }

        .signoff-name {
            font-weight: 600;
            color: #0f172a;
            margin-top: 4px;
        }

        .footer {
            background-color: {{ $footerBg ?? '#f8fafc' }};
            padding: 28px 24px;
            text-align: center;
            border-top: 1px solid rgba(0, 0, 0, 0.06);
        }

        .footer-logo {
            font-size: 18px;
            font-weight: 700;
            color: {{ $footerTextColor ?? '#080e1f' }};
            margin-bottom: 6px;
            letter-spacing: -0.3px;
        }

        .footer p {
            font-size: 12px;
            color: {{ $footerTextColor ?? '#64748b' }};
            margin: 6px 0;
            text-align: center;
            line-height: 1.5;
        }

        .footer a {
            color: {{ $footerTextColor ?? '#2563eb' }};
            text-decoration: underline;
            font-weight: 500;
        }

        .footer a:hover {
            text-decoration: underline;
        }

        @media (max-width: 600px) {
            body {
                padding: 12px 6px;
            }

            .content {
                padding: 28px 20px;
            }

            .button {
                display: block;
                width: 100%;
                text-align: center;
            }
        }
    </style>
</head>

<body>
    <div class="email-wrapper">
        <!-- Header -->
        <div class="header" style="background-color: {{ $effectiveHeaderBg }}; padding: 28px 24px; text-align: center; border-bottom: 1px solid {{ $headerBorderColor }};">
            <a href="{{ config('app.frontend_url') ?? config('app.url') }}" target="_blank" rel="noopener" style="color: {{ $headerTextColor }}; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; gap: 10px;">
                @php
                    $appUrl = config('app.url');
                    $logoBase = config('app.frontend_url') ?? (empty($appUrl) ? 'http://localhost:8080' : $appUrl);
                @endphp
                <img src="{{ rtrim($logoBase, '/') . '/images/logo-5.png' }}" width="28" height="28" alt="Boomerr" style="vertical-align: middle; border: 0; outline: none;" />
                <h1 style="font-size: 24px; font-weight: 700; color: {{ $headerTextColor }}; margin: 0; display: inline-block; vertical-align: middle; letter-spacing: -0.5px;">Boomerr</h1>
            </a>
        </div>

        <!-- Body Content -->
        <div class="content">
            {{ $slot }}
        </div>

        <!-- Footer -->
        <div class="footer" style="background-color: {{ $footerBg ?? '#f8fafc' }}; color: {{ $footerTextColor ?? '#64748b' }};">
            @if(isset($footerContent) && !empty(trim($footerContent)))
                <p style="color: {{ $footerTextColor ?? '#64748b' }}; font-size: 12px; margin-bottom: 8px;">
                    {!! nl2br(e($footerContent)) !!}
                </p>
            @else
                <div class="footer-logo" style="color: {{ $footerTextColor ?? '#080e1f' }};">Boomerr</div>
                <p style="color: {{ $footerTextColor ?? '#64748b' }};">High-reliability domain monitoring, SSL tracking & ad-spend protection.</p>
                <p style="color: {{ $footerTextColor ?? '#64748b' }};">&copy; {{ date('Y') }} Boomerr. All rights reserved.</p>
            @endif
            @if(isset($unsubscribeUrl) && !empty($unsubscribeUrl))
                <p style="margin-top: 12px; color: {{ $footerTextColor ?? '#64748b' }};">
                    You are receiving this email based on your account notifications.<br>
                    <a href="{{ $unsubscribeUrl }}" target="_blank" rel="noopener" style="color: {{ $footerTextColor ?? '#2563eb' }}; text-decoration: underline;">Update preferences or unsubscribe</a>
                </p>
            @endif
        </div>
    </div>
</body>

</html>