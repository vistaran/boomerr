import { useEffect, useState } from "react";
import { fetchRuntimeConfig, getCachedRuntimeConfig } from "../reverb-echo";

export function useRuntimeConfig() {
    const cached = getCachedRuntimeConfig();
    const [config, setConfig] = useState<{
        app_name: string;
        reverb_key: string;
        hcaptcha_site_key: string;
        billing_enabled: boolean;
    } | null>(cached);
    const [loading, setLoading] = useState<boolean>(!cached);

    useEffect(() => {
        let isMounted = true;
        fetchRuntimeConfig().then((data) => {
            if (isMounted) {
                if (data) {
                    setConfig(data);
                }
                setLoading(false);
            }
        });
        return () => {
            isMounted = false;
        };
    }, []);

    const hcaptchaSiteKey = config?.hcaptcha_site_key || import.meta.env.VITE_HCAPTCHA_SITE_KEY || "";
    const billingEnabled = config?.billing_enabled ?? (import.meta.env.VITE_ENABLE_BILLING === "true" || false);

    return {
        config,
        loading,
        hcaptchaSiteKey,
        billingEnabled,
    };
}
