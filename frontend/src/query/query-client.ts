import {
  QueryClient,
  QueryCache,
  MutationCache,
} from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { isApiError, clearAuthData } from '../api/api-client';

/**
 * Global error handler for queries.
 * Handles 401 errors by clearing auth and redirecting to login.
 */
function handleQueryError(error: unknown, query: any): void {
  // If the query explicitly suppresses global error toasts, we skip
  if (query?.meta?.suppressErrorToast) {
    return;
  }

  if (isApiError(error)) {
    // Handle unauthorized errors globally
    if (error.isUnauthorized || error.status === 401) {
      clearAuthData();
      // Dispatch custom event for App to handle logout
      window.dispatchEvent(new CustomEvent('dm-auth-error'));
      toast.error('Session expired. Please log in again.');
      return;
    }

    // Show error toast for other API errors
    toast.error(error.message || 'An error occurred');
  } else if (error instanceof Error) {
    toast.error(error.message || 'An unexpected error occurred');
  }
}

/**
 * Global error handler for mutations.
 * Only handles 401 errors; other errors should be handled by the mutation's onError.
 */
function handleMutationError(error: unknown): void {
  if (isApiError(error) && (error.isUnauthorized || error.status === 401)) {
    clearAuthData();
    window.dispatchEvent(new CustomEvent('dm-auth-error'));
    toast.error('Session expired. Please log in again.');
  }
  // Note: Other mutation errors are typically handled by the specific mutation's onError
}

/**
 * Creates a configured QueryClient instance with:
 * - Sensible default options
 * - Retry logic with exponential backoff
 * - Global error handling
 * - Cache configuration
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: handleQueryError,
    }),
    mutationCache: new MutationCache({
      onError: handleMutationError,
    }),
    defaultOptions: {
      queries: {
        // Data is considered fresh for 30 seconds
        staleTime: 30 * 1000,
        
        // Keep unused data in cache for 5 minutes
        gcTime: 5 * 60 * 1000,
        
        // Retry failed requests up to 3 times
        retry: (failureCount, error) => {
          // Don't retry on 4xx errors (client errors)
          if (isApiError(error) && error.status && error.status >= 400 && error.status < 500) {
            return false;
          }
          return failureCount < 3;
        },
        
        // Exponential backoff for retries
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        
        // Refetch on window focus for fresh data
        refetchOnWindowFocus: true,
        
        // Don't refetch on mount if data is still fresh
        refetchOnMount: true,
        
        // Refetch on reconnect
        refetchOnReconnect: true,
      },
      mutations: {
        // Retry mutations once for network errors
        retry: (failureCount, error) => {
          // Don't retry on 4xx errors
          if (isApiError(error) && error.status && error.status >= 400 && error.status < 500) {
            return false;
          }
          return failureCount < 1;
        },
      },
    },
  });
}

// Singleton instance for the app
export const queryClient = createQueryClient();
