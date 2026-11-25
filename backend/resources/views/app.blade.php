<!DOCTYPE html>
<html lang="en">
<head>
    <script>
        (function() {
            const urlParams = new URLSearchParams(window.location.search);
            const shop = urlParams.get('shop');
            const token = urlParams.get('token');
            const pathname = window.location.pathname;

            // Handshake & Breakout: If we have a shop but no token, we MUST authenticate
            // If we are in an iframe (embedded), we MUST breakout to land on the standalone dashboard
            const isEmbedded = urlParams.get('embedded') === '1' || window.top !== window.self;
            
            // Universal Breakout Helper
            function forceBreakout(url) {
                console.log("Triggering breakout to: " + url);
                try {
                    const link = document.createElement('a');
                    link.href = url;
                    link.target = '_top';
                    (document.body || document.documentElement).appendChild(link);
                    link.click();
                } catch (e) {
                    window.top.location.href = url;
                }
                // Fallback
                setTimeout(() => { window.top.location.href = url; }, 500);
            }

            // IMMEDIATE BREAKOUT: If we are in an iframe and have a shop, EJECT NOW.
            if (shop && isEmbedded && !pathname.includes('/auth/shopify')) {
                forceBreakout(window.location.href);
                return;
            }

            if (shop && !isEmbedded && !token && !pathname.includes('/auth/shopify') && !pathname.includes('/login')) {
                window.location.replace(window.location.origin + "/auth/shopify?shop=" + shop);
                return;
            }

            // Force breakout if we land on onboarding inside an iframe
            if (isEmbedded && pathname.includes('shopify-onboarding')) {
                forceBreakout(window.location.href);
            }
        })();
    </script>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Boomerr</title>

    @viteReactRefresh
    @vite(['src/main.tsx'])
</head>
<body class="bg-[#050505]">
    <div id="root"></div>
</body>
</html>
