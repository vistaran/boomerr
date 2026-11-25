/**
 * Boomerr Edge Probe Agent
 * Zero-dependency Node.js probe worker for distributed edge monitoring.
 */

const SERVER_URL = (process.env.BOOMERR_SERVER_URL || 'http://localhost:8080').replace(/\/+$/, '');
const API_KEY = process.env.BOOMERR_API_KEY || '';
const REGION = process.env.PROBE_REGION || 'eu-central-1';
const LOCATION = process.env.PROBE_LOCATION || 'Frankfurt (Germany)';
const INTERVAL_SEC = Math.max(10, parseInt(process.env.PROBE_INTERVAL || '30', 10));
const TIMEOUT_SEC = Math.max(2, parseInt(process.env.PROBE_TIMEOUT || '10', 10));

if (!API_KEY) {
    console.error('❌ Error: BOOMERR_API_KEY environment variable is required.');
    process.exit(1);
}

console.log('====================================================');
console.log(' 🚀 Boomerr Edge Monitoring Probe Agent');
console.log('====================================================');
console.log(`📡 Server URL: ${SERVER_URL}`);
console.log(`🌍 Probe Region: ${REGION} (${LOCATION})`);
console.log(`⏱️ Check Interval: ${INTERVAL_SEC}s (Timeout: ${TIMEOUT_SEC}s)`);
console.log('====================================================\n');

let checksCount24h = 0;
let successCount24h = 0;

/**
 * Fetch targets from central Boomerr instance
 */
async function fetchTargets() {
    try {
        const res = await fetch(`${SERVER_URL}/api/monitoring/targets`, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Accept': 'application/json',
                'User-Agent': `BoomerrEdgeProbe/1.0 (${REGION})`,
            },
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`HTTP ${res.status}: ${text}`);
        }

        const json = await res.json();
        return json.data || [];
    } catch (err) {
        console.error(`⚠️ Failed to fetch targets from ${SERVER_URL}: ${err.message}`);
        return [];
    }
}

/**
 * Probe a single target URL
 */
async function probeTarget(target) {
    const start = performance.now();
    const checkedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');

    checksCount24h++;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_SEC * 1000);

    try {
        const response = await fetch(target.url, {
            method: 'GET',
            signal: controller.signal,
            headers: {
                'User-Agent': 'BoomerrBot/1.0 (EdgeProbe)',
                'Accept': '*/*',
            },
            redirect: 'follow',
        });

        clearTimeout(timeoutId);
        const durationMs = Math.round(performance.now() - start);
        const isUp = response.status >= 200 && response.status < 400;

        if (isUp) successCount24h++;

        return {
            website_id: target.id,
            status: response.status,
            response_time: durationMs,
            checked_at: checkedAt,
            error: isUp ? null : `HTTP status ${response.status}`,
        };
    } catch (err) {
        clearTimeout(timeoutId);
        const durationMs = Math.round(performance.now() - start);
        const isTimeout = err.name === 'AbortError';
        const errMsg = isTimeout ? `Timeout after ${TIMEOUT_SEC}s` : (err.message || 'Connection failed');

        return {
            website_id: target.id,
            status: 0,
            response_time: durationMs,
            checked_at: checkedAt,
            error: errMsg,
        };
    }
}

/**
 * Send batch results to central Boomerr instance
 */
async function sendBatchResults(results) {
    if (!results || results.length === 0) return;

    try {
        const res = await fetch(`${SERVER_URL}/api/monitoring/results/batch`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                region: REGION,
                aws_region: REGION,
                location: LOCATION,
                source: 'docker-edge-probe',
                results: results,
            }),
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`HTTP ${res.status}: ${text}`);
        }

        console.log(`✅ [${new Date().toLocaleTimeString()}] Sent ${results.length} probe results for [${REGION}]`);
    } catch (err) {
        console.error(`❌ Failed to send batch results: ${err.message}`);
    }
}

/**
 * Send node heartbeat to central Boomerr instance
 */
async function sendHeartbeat(avgLatency) {
    try {
        const successRate = checksCount24h > 0
            ? Math.round((successCount24h / checksCount24h) * 100 * 10) / 10
            : 100;

        await fetch(`${SERVER_URL}/api/monitoring/heartbeat`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                region: REGION,
                aws_region: REGION,
                latency_ms: avgLatency || null,
                checks_run_24h: checksCount24h,
                success_rate_24h: successRate,
            }),
        });
    } catch (err) {
        // Silently tolerate transient heartbeat errors
    }
}

/**
 * Main execution loop
 */
async function runCycle() {
    const targets = await fetchTargets();

    if (targets.length === 0) {
        console.log(`ℹ️ [${new Date().toLocaleTimeString()}] No active targets found. Retrying in ${INTERVAL_SEC}s...`);
        return;
    }

    console.log(`🔍 [${new Date().toLocaleTimeString()}] Checking ${targets.length} targets from [${LOCATION}]...`);

    // Run probes concurrently with a concurrency limit of 10
    const results = [];
    const concurrency = 10;
    for (let i = 0; i < targets.length; i += concurrency) {
        const chunk = targets.slice(i, i + concurrency);
        const chunkResults = await Promise.all(chunk.map(probeTarget));
        results.push(...chunkResults);
    }

    // Calculate average latency for heartbeat
    const validLatencies = results.filter(r => r.response_time && r.status >= 200).map(r => r.response_time);
    const avgLatency = validLatencies.length > 0
        ? Math.round(validLatencies.reduce((a, b) => a + b, 0) / validLatencies.length)
        : null;

    // Send batch results & heartbeat
    await Promise.all([
        sendBatchResults(results),
        sendHeartbeat(avgLatency),
    ]);
}

// Initial immediate run, then recurring loop
runCycle();
setInterval(runCycle, INTERVAL_SEC * 1000);
