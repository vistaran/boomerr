declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

/**
 * Track a custom event in Google Analytics 4.
 *
 * @param eventName The name of the event to track.
 * @param params Optional object containing custom event parameters.
 */
export const trackEvent = (eventName: string, params?: Record<string, any>) => {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', eventName, params);
  }
};

/**
 * Track a page view in Google Analytics 4.
 *
 * @param path The path of the page viewed.
 */
export const trackPageView = (path: string) => {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', 'page_view', {
      page_path: path,
    });
  }
};

/**
 * Set the User ID in Google Analytics 4.
 *
 * @param userId The unique user ID.
 */
export const setUserId = (userId: string | number) => {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('set', {
      user_id: userId,
    });
  } else {
  }
};
