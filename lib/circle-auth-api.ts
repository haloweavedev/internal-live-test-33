// lib/circle-auth-api.ts
const CIRCLE_BASE_URL = process.env.CIRCLE_BASE_URL?.replace(/\/$/, ''); // Ensure no trailing slash
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

  // Ensure endpoint doesn't start with a slash
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
  // Use the correct base path for Headless Auth API
  const url = new URL(`${CIRCLE_BASE_URL}/api/v1/headless/${cleanEndpoint}`); 

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.append(key, String(value));
    }
  }
  const finalUrl = url.toString();

  console.log(`Calling Circle Headless Auth API: ${method} ${finalUrl}`);

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
    const response = await fetch(finalUrl, fetchOptions);

    const contentType = response.headers.get('content-type');
    let data: unknown;
    let errorText: string | null = null;

    try {
      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        errorText = await response.text();
        if (response.ok) {
          console.log(`Circle Headless Auth API ${method} ${finalUrl} returned non-JSON success (${response.status})`);
          data = { success: true, status: response.status, message: 'Operation successful (non-JSON response)' };
        } else {
          // Handled below
        }
      }
    } catch (parseError) {
      console.error(`Error parsing response body for ${method} ${finalUrl}:`, parseError);
      const error: ApiError = new Error(`Failed to parse API response: ${(parseError as Error).message}`);
      error.status = response.status;
      throw error;
    }

    if (!response.ok) {
      const baseErrorMessage = `Circle API Error: ${response.status}`;
      let detailedErrorMessage = baseErrorMessage; // Start with base message
      
      if (data && isPotentialApiErrorData(data)) {
        // If we got JSON data with a message/error, use that for the main error message
        detailedErrorMessage = data.message || data.error || baseErrorMessage;
      } else if (errorText) {
        // If we got non-JSON text (like HTML), create a generic message for logging
        // but keep the full text for the error details.
        detailedErrorMessage = `${baseErrorMessage} - Received non-JSON response (length: ${errorText.length})`;
      } else {
          detailedErrorMessage = `${baseErrorMessage} - No response body received.`;
      }

      // Log the concise message
      console.error(`Circle Headless Auth API Error (${response.status}) for ${method} ${finalUrl}: ${detailedErrorMessage}`); 
      
      // Throw an error with the detailed message, attaching full details
      const error: ApiError = new Error(detailedErrorMessage);
      error.status = response.status;
      error.details = data || errorText; // Attach full JSON data or HTML text
      throw error;
    }

    return data as T;
  } catch (error) {
    console.error(`Network or processing error in callCircleHeadlessAuthApi for ${method} ${finalUrl}:`, error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`An unknown error occurred during the Circle Headless Auth API call: ${String(error)}`);
  }
} 