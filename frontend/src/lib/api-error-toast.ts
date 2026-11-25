import toast from "react-hot-toast";

const DEFAULT_ERROR_MESSAGE = "Something went wrong. Please try again.";

/**
 * Centralized helper to surface friendly toast errors while we log the underlying issue.
 */
export function showApiErrorToast(message: string, error?: unknown): void {
    const fallback = message || DEFAULT_ERROR_MESSAGE;

    if (import.meta.env.DEV) {
        console.error(fallback, error);
    } else if (error) {
        console.error(error);
    }

    toast.error(fallback);
}
