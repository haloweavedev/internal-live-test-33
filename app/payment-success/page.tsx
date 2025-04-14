// app/payment-success/page.tsx (Server Component)
import Link from 'next/link';
import { redirect } from 'next/navigation';
import Stripe from 'stripe';
import { currentUser } from '@clerk/nextjs/server';
import { provisionCircleAccess } from '@/lib/provision';
import prisma from '@/lib/prisma';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
    console.error('FATAL: STRIPE_SECRET_KEY is not set in payment-success page.');
}
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, { typescript: true }) : null;

// --- Define Return Types for VerifyAndProvision --- 
interface ProvisionSuccessResult {
    success: true;
    redirectUrl: string;
}
interface ProvisionErrorResult {
    success: false;
    error: string;
}

// --- Helper Component for Logic & Rendering ---
async function VerifyAndProvision({ 
    sessionId, 
    spaceId, 
    communitySlug 
}: {
    sessionId: string;
    spaceId: number;
    communitySlug: string;
}): Promise<ProvisionSuccessResult | ProvisionErrorResult> {
    const user = await currentUser();
    const userId = user?.id;
    const userEmail = user?.primaryEmailAddress?.emailAddress;
    const userName = user ? (user.firstName || user.username || userEmail?.split('@')[0] || 'New Member') : 'Member';

    console.log('[VerifyAndProvision] currentUser ID:', userId); 
    console.log('[VerifyAndProvision] currentUser Email:', userEmail); 

    if (!userId || !userEmail) {
        console.error("[VerifyAndProvision] Auth check FAILED: Could not get userId or email from currentUser().");
        return { 
            success: false, 
            error: "Could not verify your user session details after payment. Please try signing out and signing back in, or contact support."
        }; // Return error data
    }
    console.log('[VerifyAndProvision] Auth check PASSED using currentUser.');

    if (!stripe) {
        console.error("[VerifyAndProvision] Stripe client not initialized.");
        return { success: false, error: "Payment processing is currently unavailable. Please contact support." }; // Return error data
    }

    try {
        // 1. Verify Stripe Session
        console.log(`[VerifyAndProvision] Verifying Stripe session: ${sessionId} for user ${userId}`);
        const session = await stripe.checkout.sessions.retrieve(sessionId, {
            expand: ['customer', 'subscription', 'line_items.data.price.product']
        });

        if (!session || session.client_reference_id !== userId) {
             throw new Error(`Invalid session (ID: ${sessionId}) or user mismatch (Expected: ${userId}, Got: ${session?.client_reference_id}).`);
        }
        if (session.payment_status !== 'paid') {
            throw new Error(`Payment status is ${session.payment_status}. Provisioning requires status 'paid'.`);
        }
        console.log(`[VerifyAndProvision] Stripe session ${sessionId} verified as paid.`);

        // 2. Extract Data & Fetch Community from DB
        const stripeSubscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
        const stripeCustomerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
        const priceId = session.line_items?.data[0]?.price?.id;

        if (!stripeSubscriptionId || !stripeCustomerId || !priceId) {
             console.error("[VerifyAndProvision] Missing critical data from Stripe session:", { stripeSubscriptionId, stripeCustomerId, priceId });
             throw new Error("Missing critical subscription/customer/price data from Stripe session.");
        }

        console.log(`[VerifyAndProvision] Fetching community with slug: ${communitySlug}`);
        const community = await prisma.community.findUnique({
             where: { slug: communitySlug },
             select: { id: true, circleSpaceId: true, stripePriceIdMonthly: true, stripePriceIdAnnually: true }
        });

        if (!community || community.circleSpaceId !== spaceId) {
             console.error('[VerifyAndProvision] Community data mismatch or not found:', { slug: communitySlug, expectedSpaceId: spaceId, foundCommunity: community });
             throw new Error("Community data mismatch or community not found.");
        }

        const planType = priceId === community.stripePriceIdMonthly ? 'monthly' :
                         priceId === community.stripePriceIdAnnually ? 'annual' : null;
        if (!planType) {
             console.error('[VerifyAndProvision] Could not determine plan type from price ID:', { priceId, community });
             throw new Error("Could not determine plan type from Stripe price ID.");
        }

        // 3. Call Provisioning Function (Idempotency handled inside)
        console.log(`[VerifyAndProvision] Calling provisionCircleAccess for user ${userId} (${userEmail}), space ${spaceId}, community ${community.id}`);
        const provisionResult = await provisionCircleAccess(
            userId,
            userEmail,
            userName,
            spaceId,
            community.id,
            stripeSubscriptionId,
            stripeCustomerId,
            planType
        );

        if (!provisionResult.success) {
            throw new Error(provisionResult.error || 'Failed to provision Circle access. Please check server logs.');
        }

        // 5. Return Success Data Instead of Redirecting
        console.log(`[VerifyAndProvision] Provisioning successful for user ${userId}, returning redirect URL.`);
        return { 
            success: true, 
            redirectUrl: `/platform-space/${spaceId}` 
        }; // Return success data

    } catch (error: unknown) {
        console.error("[VerifyAndProvision] Error during payment verification or provisioning:", error);
        // Return error data
        return { 
            success: false, 
            error: (error as Error).message || 'An unknown error occurred while setting up your access.' 
        }; 
    }
}

// --- Main Page Component ---
export default async function PaymentSuccessPage({
    searchParams 
}: {
    searchParams?: { [key: string]: string | string[] | undefined };
}) {
    // Extract params HERE from the props
    const sessionId = searchParams?.session_id as string | undefined;
    const spaceIdStr = searchParams?.spaceId as string | undefined;
    const communitySlug = searchParams?.communitySlug as string | undefined;
    let error: string | null = null;
    let spaceId: number | null = null;

    // Validate parameters
    if (!sessionId) {
        error = "Missing checkout session ID.";
    }
    if (!spaceIdStr || Number.isNaN(Number.parseInt(spaceIdStr, 10))) { 
         error = "Missing or invalid space identifier.";
    } else {
        spaceId = Number.parseInt(spaceIdStr, 10);
    }
    if (!communitySlug) {
         error = "Missing community identifier.";
    }

    // Render error immediately if basic parameters are missing/invalid
    if (error || !sessionId || !communitySlug || spaceId === null) {
        console.error("[PaymentSuccessPage] Invalid URL parameters:", { sessionId, spaceIdStr, communitySlug, error });
        return (
             <div className="container mx-auto p-4">
                 <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Invalid Request</AlertTitle>
                    <AlertDescription>{error || 'Required information missing in URL.'}</AlertDescription>
                 </Alert>
                 <Button asChild variant="link" className="mt-4">
                     <Link href="/">Return to Homepage</Link>
                 </Button>
             </div>
        );
    }

    // Await the result of verification and provisioning directly
    const result = await VerifyAndProvision({ sessionId, spaceId, communitySlug });

    // Handle Redirect or Error Based on Result
    if (result.success) {
        // Call redirect from the main page component scope
        console.log(`[PaymentSuccessPage] Provisioning succeeded. Redirecting to ${result.redirectUrl}...`);
        redirect(result.redirectUrl);
        // Note: Code below redirect() will not execute
    } else {
        // Render the error state returned by VerifyAndProvision
        console.error(`[PaymentSuccessPage] Provisioning failed. Error: ${result.error}`);
        return (
            <div className="container mx-auto p-4 flex flex-col items-center justify-center min-h-[60vh]">
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Subscription Finalization Failed</AlertTitle>
                    <AlertDescription>
                        {result.error}
                        <p className="mt-2">Please contact support if the issue persists, mentioning session ID: {sessionId}</p>
                    </AlertDescription>
                    <Button asChild variant="link" className="mt-4 ml-auto">
                        <Link href="/">Return to Homepage</Link>
                    </Button>
                 </Alert>
            </div>
        );
    }
} 