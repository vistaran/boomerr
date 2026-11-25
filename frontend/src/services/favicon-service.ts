// Favicon utility for domains

/**
 * Validates if a URL uses a safe protocol (http or https only)
 * Prevents XSS attacks via javascript:, data:, and other dangerous URL schemes
 */
export function isSafeUrl(url: string): boolean {
    try {
        const urlObj = new URL(url);
        // Only allow http and https protocols
        return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
        // If URL parsing fails, it's not safe
        return false;
    }
}

export function getFaviconUrl(url: string): string | null {
    // Validate URL is safe before processing
    if (!url || !isSafeUrl(url)) {
        return null;
    }

    // Special case: for generic Shopify domains, we prefer our professional fallback icon
    if (url.includes('myshopify.com')) {
        return null;
    }

    try {
        const urlObj = new URL(url);
        return `https://www.google.com/s2/favicons?domain=${urlObj.origin}&sz=64&default_icon=404`;
    } catch (e: any) {
        console.error("Invalid URL for domain:", url, e);
        return null;
    }
}
