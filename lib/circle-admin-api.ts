// lib/circle-admin-api.ts
const CIRCLE_BASE_URL = process.env.CIRCLE_BASE_URL;
const ADMIN_API_KEY = process.env.CIRCLE_ADMIN_V2_API_KEY;

// Define a more specific error type
interface ApiError extends Error {
    status?: number;
    details?: unknown;
}

interface CircleApiOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    body?: Record<string, unknown>;
    cache?: RequestCache;
    params?: Record<string, string | number | boolean>;
}

/**
 * Checks if the object is a potential Circle API error response structure.
 * Basic check for message or error properties.
 */
function isPotentialApiErrorData(data: unknown): data is { message?: string; error?: string } {
    if (typeof data !== 'object' || data === null) {
        return false;
    }
    return 'message' in data || 'error' in data;
}

/**
 * Calls the Circle Admin v2 API.
 * @param endpoint The API endpoint path (e.g., 'community_members')
 * @param options Fetch options including method, body, cache, and URL parameters.
 * @returns The JSON response from the API.
 * @throws Error if API keys are missing or if the API call fails.
 */
export async function callCircleAdminApi<T = unknown>(
  endpoint: string,
  options: CircleApiOptions = {}
): Promise<T> {
  const { method = 'GET', body, cache = 'no-store', params } = options;

  if (!ADMIN_API_KEY || !CIRCLE_BASE_URL) {
    throw new Error('Circle Admin API keys or Base URL not configured in environment variables.');
  }

  const url = new URL(`${CIRCLE_BASE_URL}/api/admin/v2/${endpoint}`);

  // Append URL search params if provided
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.append(key, String(value));
    }
  }

  console.log(`Calling Circle Admin API: ${method} ${url.toString()}`);

  const headers: HeadersInit = {
    'Authorization': `Bearer ${ADMIN_API_KEY}`,
    'Content-Type': 'application/json',
  };

  const fetchOptions: RequestInit = {
    method: method,
    headers: headers,
    cache: cache,
    ...(body && { body: JSON.stringify(body) }),
  };

  try {
    const response = await fetch(url.toString(), fetchOptions);

    // Handle potential empty responses for DELETE etc.
    if (response.status === 204 && method === 'DELETE') {
      console.log(`Circle Admin API ${method} ${url.toString()} successful (204 No Content)`);
      // @ts-expect-error - Returning success marker for 204
      return { success: true, message: 'Operation successful (No Content)' } as T;
    }

    const contentType = response.headers.get('content-type');
    let data: unknown;
    let errorText: string | null = null;

    try {
      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        errorText = await response.text(); // Read as text if not JSON
        if (response.ok) {
          console.log(`Circle Admin API ${method} ${url.toString()} returned non-JSON success (${response.status})`);
          data = { success: true, status: response.status, message: 'Operation successful (non-JSON response)' };
        } else {
          // Will be handled by !response.ok check below
        }
      }
    } catch (parseError) {
      console.error(`Error parsing response body for ${method} ${url.toString()}:`, parseError);
      // Throw a specific parsing error
      const error: ApiError = new Error(`Failed to parse API response: ${(parseError as Error).message}`);
      error.status = response.status; // Attach status if available
      throw error;
    }

    if (!response.ok) {
      let errorMessage = `Circle API Error: ${response.status}`;
      if (data && isPotentialApiErrorData(data)) {
        errorMessage = data.message || data.error || errorMessage;
      } else if (errorText) {
        errorMessage = `${errorMessage} - ${errorText}`;
      }
      console.error(`Circle Admin API Error (${response.status}) for ${method} ${url.toString()}:`, data || errorText);
      const error: ApiError = new Error(errorMessage);
      error.status = response.status;
      error.details = data || errorText; // Attach full response data or text
      throw error;
    }

    return data as T;
  } catch (error) {
    console.error(`Network or processing error in callCircleAdminApi for ${method} ${url.toString()}:`, error);
    if (error instanceof Error) {
      // Re-throw original error (could be the ApiError created above)
      throw error;
    }
    // Wrap unknown errors
    throw new Error(`An unknown error occurred during the Circle API call: ${String(error)}`);
  }
} 