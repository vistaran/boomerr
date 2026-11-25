/**
 * Lazily loads the Razorpay checkout SDK only when a payment is triggered.
 * The script is cached after first load so subsequent calls are instant.
 */
let razorpayLoadPromise: Promise<void> | null = null;

export function loadRazorpay(): Promise<void> {
    // Return cached promise if already loading/loaded
    if (razorpayLoadPromise) return razorpayLoadPromise;

    // Already loaded
    if (typeof window.Razorpay === 'function') {
        return Promise.resolve();
    }

    razorpayLoadPromise = new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => {
            razorpayLoadPromise = null; // Allow retry on failure
            reject(new Error('Failed to load Razorpay SDK'));
        };
        document.head.appendChild(script);
    });

    return razorpayLoadPromise;
}
