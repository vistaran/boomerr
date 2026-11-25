/**
 * Boomerr AWS Lambda Edge Probe Function
 * Handles asynchronous invocations from Boomerr central scheduler.
 */

export const handler = async (event) => {
    const serverUrl = (process.env.BOOMERR_SERVER_URL || '').replace(/\/+$/, '');
    const apiKey = process.env.BOOMERR_API_KEY || '';
    const region = process.env.AWS_REGION || 'us-east-1';

    if (!serverUrl || !apiKey) {
        console.error('Missing BOOMERR_SERVER_URL or BOOMERR_API_KEY environment variables.');
        return { statusCode: 500, body: 'Missing configuration' };
    }

    // 1. Handle Heartbeat (Scheduled Event)
    if (event.source === 'aws.events' || event.type === 'heartbeat') {
        try {
            await fetch(`${serverUrl}/api/monitoring/heartbeat`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    region: region,
                    aws_region: region,
                    latency_ms: 10,
                }),
            });
            return { statusCode: 200, body: 'Heartbeat recorded' };
        } catch (err) {
            console.error('Heartbeat failed:', err.message);
            return { statusCode: 500, body: err.message };
        }
    }

    // 2. Handle Website Monitoring Check
    const websiteId = event.website_id;
    const targetUrl = event.url;

    if (!websiteId || !targetUrl) {
        console.error('Invalid payload: website_id and url are required.', event);
        return { statusCode: 400, body: 'Missing website_id or url' };
    }

    const start = performance.now();
    const checkedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const timeoutSec = 15;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutSec * 1000);

    let status = 0;
    let durationMs = 0;
    let error = null;

    try {
        const response = await fetch(targetUrl, {
            method: 'GET',
            signal: controller.signal,
            headers: {
                'User-Agent': 'BoomerrBot/1.0 (LambdaEdgeProbe)',
                'Accept': '*/*',
            },
            redirect: 'follow',
        });

        clearTimeout(timeoutId);
        durationMs = Math.round(performance.now() - start);
        status = response.status;
        if (status < 200 || status >= 400) {
            error = `HTTP status ${status}`;
        }
    } catch (err) {
        clearTimeout(timeoutId);
        durationMs = Math.round(performance.now() - start);
        error = err.name === 'AbortError' ? `Timeout after ${timeoutSec}s` : (err.message || 'Connection failed');
    }

    // 3. Post result back to Boomerr central instance
    try {
        const postRes = await fetch(`${serverUrl}/api/monitoring/results`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                website_id: websiteId,
                status: status,
                response_time: durationMs,
                checked_at: checkedAt,
                region: region,
                aws_region: region,
                source: 'lambda',
                error: error,
            }),
        });

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                website_id: websiteId,
                status: status,
                response_time: durationMs,
            }),
        };
    } catch (err) {
        console.error('Failed to post result back to Boomerr:', err.message);
        return { statusCode: 502, body: err.message };
    }
};
