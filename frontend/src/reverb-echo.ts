import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

let cachedRuntimeConfig: { app_name: string; reverb_key: string; hcaptcha_site_key: string; billing_enabled: boolean } | null = null;
let runtimeConfigPromise: Promise<{ app_name: string; reverb_key: string; hcaptcha_site_key: string; billing_enabled: boolean } | null> | null = null;

export async function fetchRuntimeConfig(): Promise<{ app_name: string; reverb_key: string; hcaptcha_site_key: string; billing_enabled: boolean } | null> {
    if (cachedRuntimeConfig) {
        return cachedRuntimeConfig;
    }

    if (!runtimeConfigPromise) {
        const apiBase = (import.meta.env.VITE_API_BASE_URL || (typeof window !== 'undefined' ? `${window.location.origin}/api` : '/api')).replace(/\/+$/, '');
        runtimeConfigPromise = fetch(`${apiBase}/config`)
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                if (data) {
                    cachedRuntimeConfig = data;
                }
                return data;
            })
            .catch(() => null);
    }

    return runtimeConfigPromise;
}

export function getCachedRuntimeConfig() {
    return cachedRuntimeConfig;
}

// Kick off config fetch eagerly on load
if (typeof window !== 'undefined') {
    fetchRuntimeConfig();
}

declare global {
    interface Window {
        Pusher: typeof Pusher;
    }
}

window.Pusher = Pusher;
Pusher.logToConsole = import.meta.env.DEV;

export function createEcho(token: string, explicitKey?: string) {
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const reverbScheme = (import.meta.env.VITE_REVERB_SCHEME || (isHttps ? 'https' : 'http')).toLowerCase();
    const useTls = reverbScheme === 'https';

    const reverbHost = import.meta.env.VITE_REVERB_HOST || (typeof window !== 'undefined' ? window.location.hostname : 'localhost');
    const defaultPort = typeof window !== 'undefined' && window.location.port
        ? Number(window.location.port)
        : (useTls ? 443 : 80);
    const reverbPort = import.meta.env.VITE_REVERB_PORT ? Number(import.meta.env.VITE_REVERB_PORT) : defaultPort;

    const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/api$/, '');
    const reverbKey = explicitKey || cachedRuntimeConfig?.reverb_key || import.meta.env.VITE_REVERB_APP_KEY || 'boomerr-key';

    return new Echo({
        broadcaster: 'reverb',
        key: reverbKey,
        wsHost: reverbHost,
        wsPort: reverbPort,
        wssPort: reverbPort,
        forceTLS: useTls,
        enabledTransports: ["ws", "wss"],
        authEndpoint: `${apiBaseUrl}/broadcasting/auth`,
        auth: {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        },
    });
}
