/**
 * Generic type for standardized API responses.
 * @template T - The type of the data payload on success.
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  details?: unknown; // For optional detailed error info
}

/**
 * Data returned on successful Stripe Checkout Session creation.
 */
export interface CheckoutSessionData {
  sessionId?: string; // Optional: Keep sessionId if used elsewhere
  checkoutUrl: string; // Add the missing checkoutUrl property
}

// Add other shared types below
// export type CommunityData = { ... }; 