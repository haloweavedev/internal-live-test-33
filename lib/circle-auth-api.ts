// lib/circle-auth-api.ts
const CIRCLE_BASE_URL = process.env.CIRCLE_BASE_URL;
// Use the Headless Auth API Key
const HEADLESS_AUTH_API_KEY = process.env.CIRCLE_HEADLESS_AUTH_API_KEY;

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
 */
function isPotentialApiErrorData(data: unknown): data is { message?: string; error?: string } {
    if (typeof data !== 'object' || data === null) {
        return false;
    }
    return 'message' in data || 'error' in data;
}

/**
 * Calls the Circle Headless Auth API (for generating member tokens).
 * @param endpoint The API endpoint path (e.g., 'auth_token')
 * @param options Fetch options including method, body, cache, and URL parameters.
 * @returns The JSON response from the API.
 * @throws Error if API keys are missing or if the API call fails.
 */
export async function callCircleHeadlessAuthApi<T = unknown>(
  endpoint: string,
  options: CircleApiOptions = {}
): Promise<T> {
  const { method = 'GET', body, cache = 'no-store', params } = options;

  if (!HEADLESS_AUTH_API_KEY || !CIRCLE_BASE_URL) {
    throw new Error('Circle Headless Auth API Key or Base URL not configured.');
  }

  // Construct URL - Headless Auth endpoints might be different path, adjust if needed
  // Assuming they are under /api/headless/v1/ for now - PLEASE VERIFY Circle Docs
  const url = new URL(`${CIRCLE_BASE_URL}/api/headless/v1/${endpoint}`);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.append(key, String(value));
    }
  }

  console.log(`Calling Circle Headless Auth API: ${method} ${url.toString()}`);

  const headers: HeadersInit = {
    // Use the Headless Auth Key
    'Authorization': `Bearer ${HEADLESS_AUTH_API_KEY}`,
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

    const contentType = response.headers.get('content-type');
    let data: unknown;
    let errorText: string | null = null;

    try {
      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        errorText = await response.text();
        if (response.ok) {
          console.log(`Circle Headless Auth API ${method} ${url.toString()} returned non-JSON success (${response.status})`);
          data = { success: true, status: response.status, message: 'Operation successful (non-JSON response)' };
        } else {
          // Will be handled below
        }
      }
    } catch (parseError) {
      console.error(`Error parsing response body for ${method} ${url.toString()}:`, parseError);
      const error: ApiError = new Error(`Failed to parse API response: ${(parseError as Error).message}`);
      error.status = response.status;
      throw error;
    }

    if (!response.ok) {
      let errorMessage = `Circle API Error: ${response.status}`;
      if (data && isPotentialApiErrorData(data)) {
        errorMessage = data.message || data.error || errorMessage;
      } else if (errorText) {
        errorMessage = `${errorMessage} - ${errorText}`;
      }
      console.error(`Circle Headless Auth API Error (${response.status}) for ${method} ${url.toString()}:`, data || errorText);
      const error: ApiError = new Error(errorMessage);
      error.status = response.status;
      error.details = data || errorText;
      throw error;
    }

    return data as T;
  } catch (error) {
    console.error(`Network or processing error in callCircleHeadlessAuthApi for ${method} ${url.toString()}:`, error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`An unknown error occurred during the Circle Headless Auth API call: ${String(error)}`);
  }
} 