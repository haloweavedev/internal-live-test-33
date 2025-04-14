// lib/circle-member-api.ts
const CIRCLE_BASE_URL = process.env.CIRCLE_BASE_URL;

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
    accessToken: string; // Mandatory
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
 * Calls the Circle Member API (v1).
 * Requires a valid member access token.
 * @param endpoint The API endpoint path (e.g., 'spaces/:id')
 * @param options Fetch options including method, body, cache, URL parameters, and accessToken.
 * @returns The JSON response from the API.
 * @throws Error if Base URL is missing or if the API call fails.
 */
export async function callCircleMemberApi<T = unknown>(
    endpoint: string,
    options: CircleApiOptions
): Promise<T> {
    const { method = 'GET', body, cache = 'no-store', params, accessToken } = options;

    if (!CIRCLE_BASE_URL) {
        throw new Error('Circle Base URL not configured.');
    }
    if (!accessToken) {
        throw new Error('Circle Member API access token is required.');
    }

    const url = new URL(`${CIRCLE_BASE_URL}/api/v1/${endpoint}`);

    if (params) {
        for (const [key, value] of Object.entries(params)) {
            url.searchParams.append(key, String(value));
        }
    }

    console.log(`Calling Circle Member API: ${method} ${url.toString()}`);

    const headers: HeadersInit = {
        'Authorization': `Bearer ${accessToken}`,
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
                    console.log(`Circle Member API ${method} ${url.toString()} returned non-JSON success (${response.status})`);
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
            console.error(`Circle Member API Error (${response.status}) for ${method} ${url.toString()}:`, data || errorText);
            const error: ApiError = new Error(errorMessage);
            error.status = response.status;
            error.details = data || errorText;
            throw error;
        }

        return data as T;
    } catch (error) {
        console.error(`Network or processing error in callCircleMemberApi for ${method} ${url.toString()}:`, error);
        if (error instanceof Error) {
            throw error;
        }
        throw new Error(`An unknown error occurred during the Circle Member API call: ${String(error)}`);
    }
} 