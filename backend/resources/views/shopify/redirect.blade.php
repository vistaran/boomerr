<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Redirecting...</title>
    <script>
        // This is a small helper to redirect the iframe to the local frontend.
        // By doing it in JS, we bypass the browser's strict server-side redirect blocks.
        window.location.href = "{{ $redirectUrl }}";
    </script>
</head>
<body>
    <div style="font-family: sans-serif; text-align: center; padding-top: 50px;">
        <p>Connecting to Boomer...</p>
    </div>
</body>
</html>
