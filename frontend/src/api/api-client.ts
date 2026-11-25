/**
 * Centralized API client with authentication and error handling.
 * Used by React Query hooks for all API requests.
 */

const envApi = import.meta.env.VITE_API_BASE_URL;
const API_BASE = (import.meta.env.PROD || !envApi || envApi.includes('localhost:8000'))
  ? '/api'
  : envApi;

export type ApiError = Error & {
  status?: number;
  payload?: unknown;
  isUnauthorized?: boolean;
};

export function isApiError(error: unknown): error is ApiError {
  return error instanceof Error && 'status' in error;
}

export type ApiRequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  skipAuth?: boolean;
};

const TOKEN_KEY = 'dm_token';
const USER_KEY = 'dm_user';

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthData(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isAuthenticated(): boolean {
  return !!getAuthToken();
}

function extractErrorMessage(data: unknown): string | null {
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    
    // Check for direct message
    if (typeof obj.message === 'string') {
      return obj.message;
    }
    
    // Check for Laravel validation errors
    const errors = obj.errors as unknown;
    if (errors && typeof errors === 'object') {
      const bag = errors as Record<string, unknown>;
      const msgs: string[] = [];
      Object.values(bag).forEach((v) => {
        if (Array.isArray(v)) {
          v.forEach((item) => {
            if (typeof item === 'string') msgs.push(item);
          });
        }
      });
      if (msgs.length) return msgs.join(', ');
    }
  }
  return null;
}


/**
 * Core API client function with automatic auth token injection and error handling.
 * 
 * @param endpoint - API endpoint (will be appended to API_BASE)
 * @param options - Request options including method, body, headers
 * @returns Promise resolving to the parsed JSON response
 * @throws ApiError with status code and payload for non-ok responses
 */
export async function apiClient<T = unknown>(
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const { body, skipAuth = false, headers: customHeaders, ...restOptions } = options;

  const token = getAuthToken();

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...((customHeaders as Record<string, string>) || {}),
  };

  // Inject auth token unless explicitly skipped
  if (token && !skipAuth) {
    headers.Authorization = `Bearer ${token}`;
  }

  const config: RequestInit = {
    ...restOptions,
    headers,
  };

  // Serialize body if present
  if (body !== undefined) {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, config);

  // Parse response body
  let data: unknown = null;
  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      // Empty or invalid JSON response
    }
  }

  // Handle error responses
  if (!response.ok) {
    const message = extractErrorMessage(data) ?? getDefaultErrorMessage(response.status);
    const apiError = new Error(message) as ApiError;
    apiError.status = response.status;
    apiError.payload = data;
    apiError.isUnauthorized = response.status === 401;
    throw apiError;
  }

  return data as T;
}

function getDefaultErrorMessage(status: number): string {
  switch (status) {
    case 400:
      return 'Bad request';
    case 401:
      return 'Unauthorized';
    case 403:
      return 'Forbidden';
    case 404:
      return 'Not found';
    case 422:
      return 'Validation error';
    case 429:
      return 'Too many requests';
    case 500:
      return 'Server error';
    default:
      return 'Request failed';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience Methods
// ─────────────────────────────────────────────────────────────────────────────

export const api = {
  get: <T = unknown>(endpoint: string, options?: Omit<ApiRequestOptions, 'method'> & { params?: Record<string, any> }) => {
    let url = endpoint;
    if (options && options.params) {
      const params = options.params;
      const query = Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');
      if (query) {
        url += (url.includes('?') ? '&' : '?') + query;
      }
    }
    const rest = options ? { ...options, params: undefined } : {};
    return apiClient<T>(url, { ...rest, method: 'GET' });
  },
  post: <T = unknown>(endpoint: string, body?: unknown, options?: Omit<ApiRequestOptions, 'method' | 'body'>) =>
    apiClient<T>(endpoint, { ...options, method: 'POST', body }),
  put: <T = unknown>(endpoint: string, body?: unknown, options?: Omit<ApiRequestOptions, 'method' | 'body'>) =>
    apiClient<T>(endpoint, { ...options, method: 'PUT', body }),
  patch: <T = unknown>(endpoint: string, body?: unknown, options?: Omit<ApiRequestOptions, 'method' | 'body'>) =>
    apiClient<T>(endpoint, { ...options, method: 'PATCH', body }),
  delete: <T = unknown>(endpoint: string, options?: Omit<ApiRequestOptions, 'method'>) =>
    apiClient<T>(endpoint, { ...options, method: 'DELETE' }),
};
