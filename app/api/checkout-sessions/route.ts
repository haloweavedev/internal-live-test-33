import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth, createClerkClient } from '@clerk/nextjs/server';
import Stripe from 'stripe';
import type { ApiResponse, CheckoutSessionData } from '@/types';
// import { provisionUserAccess } from '@/lib/provision'; // Commented out as likely unused in this specific context

// --- Environment Variable Checks ---
console.log(`API Route Init: CLERK_SECRET_KEY is ${process.env.CLERK_SECRET_KEY ? 'SET' : 'NOT SET'}`);
console.log(`API Route Init: STRIPE_SECRET_KEY is ${process.env.STRIPE_SECRET_KEY ? 'SET' : 'NOT SET'}`);
console.log(`API Route Init: NEXT_PUBLIC_BASE_URL is ${process.env.NEXT_PUBLIC_BASE_URL ? 'SET' : 'NOT SET'}`);
const clerkSecretKey = process.env.CLERK_SECRET_KEY;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
// --- End Checks ---

if (!clerkSecretKey) {
    console.error('FATAL: CLERK_SECRET_KEY environment variable is not set.');
}
if (!stripeSecretKey) {
    console.error('FATAL: STRIPE_SECRET_KEY environment variable is not set.');
}

// Initialize Stripe client (only if key exists)
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, {
    // Removed apiVersion to use library default
    typescript: true,
}) : null;

// Initialize Clerk Backend Client using the factory function
const clerkClient = clerkSecretKey ? createClerkClient({ secretKey: clerkSecretKey }) : null;

// Define EmailAddress type based on Clerk's structure
interface EmailAddress {
    id: string | null;
    emailAddress: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<CheckoutSessionData>>> {
    if (!stripe || !clerkClient) {
        const errorMsg = !stripe ? 'Stripe configuration error.' : 'Clerk configuration error (secret key missing?).';
        console.error('Configuration Error:', errorMsg);
        return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
    }

    try {
  const authObject = await auth(); 
  const userId = authObject.userId;

  if (!userId) {
            console.warn('Unauthorized attempt to create checkout session without user ID.');
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }); 
  }

        // --- Start: Improved Email Fetching --- 
        let userEmail: string | undefined | null = authObject.sessionClaims?.email as string | undefined | null; 

  if (!userEmail) {
            try {
                console.log(`Email not in claims for ${userId}, attempting direct fetch...`);
                // Use the explicitly created clerkClient instance
                const user = await clerkClient.users.getUser(userId); 
                userEmail = user.emailAddresses.find((e: EmailAddress) => e.id === user.primaryEmailAddressId)?.emailAddress;
                if (userEmail) {
                     console.log(`Successfully fetched email for ${userId} directly.`);
                } else {
                     console.warn(`Primary email not found for user ${userId} even after direct fetch.`);
                }
            } catch (fetchError: unknown) {
                console.error(`Failed to fetch Clerk user details for ${userId}:`, fetchError);
                 let errorMsg = 'Could not fetch user details to proceed with checkout.';
                 if (fetchError instanceof Error) {
                     errorMsg = `${errorMsg} Reason: ${fetchError.message}`;
                 }
                // Return a server error as we couldn't verify email due to an API issue
                return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
            }
        }

        if (!userEmail) {
            console.error(`User email could not be determined for Clerk user ID: ${userId}. Cannot proceed with checkout.`);
            // This indicates a configuration or data issue (user might not have a primary email)
            return NextResponse.json({ success: false, error: 'User primary email could not be determined' }, { status: 400 });
        }
        // --- End: Improved Email Fetching ---

    const body = await request.json();
        const { priceId, communitySlug, communityName, planType, circleSpaceId } = body;

        // Validate required fields from the request body
        if (!priceId || typeof priceId !== 'string') {
            return NextResponse.json({ success: false, error: 'Missing or invalid priceId (string)' }, { status: 400 });
        }
        if (!communitySlug || typeof communitySlug !== 'string') {
            return NextResponse.json({ success: false, error: 'Missing or invalid communitySlug (string)' }, { status: 400 });
        }
        if (!circleSpaceId || typeof circleSpaceId !== 'number') {
            return NextResponse.json({ success: false, error: 'Missing or invalid circleSpaceId (number)' }, { status: 400 });
        }
        if (!communityName || typeof communityName !== 'string') {
            return NextResponse.json({ success: false, error: 'Missing or invalid communityName (string)' }, { status: 400 });
        }
        if (!planType || typeof planType !== 'string') {
            return NextResponse.json({ success: false, error: 'Missing or invalid planType (string)' }, { status: 400 });
        }

        // Determine the Base URL for redirects
        let baseUrl: string;
        if (process.env.NEXT_PUBLIC_BASE_URL) {
            // Prioritize the explicitly set public base URL if available
            baseUrl = process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, ''); // Remove trailing slash if present
            console.log(`Using NEXT_PUBLIC_BASE_URL: ${baseUrl}`);
        } else if (process.env.VERCEL_URL) {
            // Fallback to Vercel's deployment URL (useful for previews without explicit base URL)
            const protocol = 'https'; // Vercel deployments are always HTTPS
            baseUrl = `${protocol}://${process.env.VERCEL_URL}`;
            console.log(`Using VERCEL_URL: ${baseUrl}`);
        } else {
            // Default for local development
            baseUrl = 'http://localhost:3000';
            console.log(`Using default localhost URL: ${baseUrl}`);
        }

        // Construct Success URL (ensure params are correctly appended)
        const successUrlParams = new URLSearchParams({
            spaceId: circleSpaceId.toString(),
            communitySlug: communitySlug,
            // session_id={CHECKOUT_SESSION_ID} is added by Stripe automatically
        });
        // Ensure no double slashes if baseUrl already ends with one (though replace above handles it)
        const successUrl = `${baseUrl}/payment-success?${successUrlParams.toString()}&session_id={CHECKOUT_SESSION_ID}`;

        // Construct Cancel URL
        const cancelUrl = `${baseUrl}/subscribe/${communitySlug}?cancelled=true`;

        console.log(`Final Base URL for redirects: ${baseUrl}`);
        console.log(`Constructed Success URL for Stripe: ${successUrl}`);
        console.log(`Constructed Cancel URL for Stripe: ${cancelUrl}`);

        console.log(`Creating Stripe checkout session for user ${userId} (${userEmail}), price ${priceId}`);

        // Look for an existing Stripe customer by email, or create one if not found
        const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
        let customerId: string;

        if (customers.data.length > 0) {
            customerId = customers.data[0].id;
            console.log(`Found existing Stripe customer: ${customerId} for email ${userEmail}`);
        } else {
            const newCustomer = await stripe.customers.create({
                email: userEmail,
                metadata: {
                    clerkUserId: userId, // Link Stripe customer to Clerk user ID
                },
            });
            customerId = newCustomer.id;
            console.log(`Created new Stripe customer: ${customerId} for email ${userEmail}`);
        }

        // Create the Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
            mode: 'subscription',
            success_url: successUrl,
            cancel_url: cancelUrl,
            customer: customerId, // Associate session with the Stripe customer
            customer_update: {
                address: 'auto'
            },
            client_reference_id: userId, // Recommended to pass Clerk User ID here
      metadata: {
                userId: userId, // Keep Clerk ID in metadata
                spaceId: circleSpaceId.toString(), // Ensure spaceId is in metadata
          priceId: priceId,
          communitySlug: communitySlug,
                planType: planType, 
            },
            automatic_tax: { enabled: true }, 
            allow_promotion_codes: true,
        });

    if (!session.url) {
            console.error('Stripe session URL was null.', session);
            return NextResponse.json({ success: false, error: 'Could not create checkout session URL.' }, { status: 500 });
    }

        console.log(`Stripe checkout session created: ${session.id} for user ${userId}`);

        // Return the session URL to the client
        return NextResponse.json<ApiResponse<CheckoutSessionData>>({ 
        success: true, 
            data: { checkoutUrl: session.url }
        });

    } catch (error: unknown) {
        console.error('Error creating Stripe checkout session:', error);
        let errorMessage = 'An unexpected error occurred.';
        if (error instanceof Error) {
            errorMessage = error.message;
        }
        return NextResponse.json<ApiResponse<never>>({ success: false, error: `Could not create checkout session: ${errorMessage}`, details: error }, { status: 500 }); // Include more detail in error
  }
} 