import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import Stripe from 'stripe';
import type { ApiResponse } from '@/types';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, { typescript: true }) : null;

interface BillingPortalData {
    portalUrl: string;
}

export async function POST(): Promise<NextResponse<ApiResponse<BillingPortalData>>> {
    if (!stripe) {
        console.error('Stripe configuration error in billing-portal API.');
        return NextResponse.json({ success: false, error: 'Billing service unavailable.' }, { status: 500 });
    }

    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        // Fetch the user's Stripe Customer ID from your database
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { stripeCustomerId: true },
        });

        if (!user || !user.stripeCustomerId) {
            console.error(`Stripe Customer ID not found for user ${userId}`);
            return NextResponse.json({ success: false, error: 'Billing information not found for this user.' }, { status: 404 });
        }

        // Determine the return URL dynamically
        let returnUrl: string;
        const publicBaseUrl = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, '');
        const vercelUrl = process.env.VERCEL_URL;

        if (publicBaseUrl) {
            returnUrl = `${publicBaseUrl}/account`;
        } else if (vercelUrl) {
            returnUrl = `https://${vercelUrl}/account`;
        } else {
            returnUrl = 'http://localhost:3000/account'; // Fallback for local
        }
         console.log(`Generating Stripe Billing Portal session for customer ${user.stripeCustomerId} with return URL: ${returnUrl}`);


        const portalSession = await stripe.billingPortal.sessions.create({
            customer: user.stripeCustomerId,
            return_url: returnUrl,
        });

        return NextResponse.json({ success: true, data: { portalUrl: portalSession.url } });

    } catch (error: unknown) {
        console.error('Error creating Stripe Billing Portal session:', error);
        const errorMessage = (error instanceof Error) ? error.message : 'Could not create billing portal session.';
        return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
    }
} 