import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import StripeAPI from 'stripe';
import prisma from '@/lib/prisma';
import { provisionCircleAccess } from '@/lib/provision';

// Initialize Stripe client
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new StripeAPI(stripeSecretKey, { typescript: true }) : null;

export async function POST(request: NextRequest) {
    // 1. Get user from Clerk
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const user = await currentUser();
    const userEmail = user?.primaryEmailAddress?.emailAddress;
    const userName = user ? (user.firstName || user.username || userEmail?.split('@')[0] || 'New Member') : 'Member';

    if (!userEmail) {
        return NextResponse.json({ 
            success: false, 
            error: "Could not verify your user session details after payment. Please try signing out and signing back in, or contact support."
        }, { status: 400 });
    }

    if (!stripe) {
        return NextResponse.json({ 
            success: false, 
            error: "Payment processing is currently unavailable. Please contact support." 
        }, { status: 500 });
    }

    try {
        // 2. Parse request body
        const body = await request.json();
        const { sessionId, spaceId, communitySlug } = body;

        if (!sessionId || !spaceId || !communitySlug) {
            return NextResponse.json({ 
                success: false, 
                error: "Missing required parameters" 
            }, { status: 400 });
        }

        // 3. Verify Stripe Session
        const session = await stripe.checkout.sessions.retrieve(sessionId, {
            expand: ['customer', 'subscription', 'line_items.data.price.product']
        });

        if (!session || session.client_reference_id !== userId) {
            return NextResponse.json({ 
                success: false, 
                error: 'Invalid session or user mismatch.'
            }, { status: 400 });
        }

        if (session.payment_status !== 'paid') {
            return NextResponse.json({ 
                success: false, 
                error: 'Payment status is not valid. Provisioning requires paid status.'
            }, { status: 400 });
        }

        // 4. Extract Data & Fetch Community from DB
        const stripeSubscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
        const stripeCustomerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
        const priceId = session.line_items?.data[0]?.price?.id;

        if (!stripeSubscriptionId || !stripeCustomerId || !priceId) {
            return NextResponse.json({ 
                success: false, 
                error: "Missing critical subscription/customer/price data from Stripe session."
            }, { status: 400 });
        }

        const community = await prisma.community.findUnique({
            where: { slug: communitySlug },
            select: { id: true, circleSpaceId: true, stripePriceIdMonthly: true, stripePriceIdAnnually: true }
        });

        if (!community || community.circleSpaceId !== spaceId) {
            return NextResponse.json({ 
                success: false, 
                error: "Community data mismatch or community not found."
            }, { status: 400 });
        }

        const planType = priceId === community.stripePriceIdMonthly ? 'monthly' :
                        priceId === community.stripePriceIdAnnually ? 'annual' : null;
        if (!planType) {
            return NextResponse.json({ 
                success: false, 
                error: "Could not determine plan type from Stripe price ID."
            }, { status: 400 });
        }

        // 5. Call Provisioning Function
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
            return NextResponse.json({ 
                success: false, 
                error: provisionResult.error || 'Failed to provision Circle access. Please check server logs.'
            }, { status: 500 });
        }

        // 6. Return Success
        return NextResponse.json({ 
            success: true, 
            redirectUrl: `/platform-space/${spaceId}`
        });

    } catch (error: unknown) {
        console.error("Error during payment verification or provisioning:", error);
        return NextResponse.json({ 
            success: false, 
            error: (error as Error).message || 'An unknown error occurred while setting up your access.'
        }, { status: 500 });
    }
} 