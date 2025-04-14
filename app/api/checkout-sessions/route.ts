import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { auth } from '@clerk/nextjs/server'; // Import server-side auth

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  throw new Error('The STRIPE_SECRET_KEY environment variable is not set.');
}

const stripe = new Stripe(stripeSecretKey, {
  // apiVersion: "2023-10-16", // Optionally specify API version
});

export async function POST(request: Request) {
  const authObject = await auth(); 
  const userId = authObject.userId;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Try to get email from auth claims or session claims first
  let userEmail = authObject.sessionClaims?.email; 

  // If email not in claims, we might need to fetch the user separately 
  // (Requires @clerk/nextjs)
  // if (!userEmail) { 
  //    try {
  //        const user = await clerkClient.users.getUser(userId);
  //        userEmail = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress;
  //    } catch (fetchError) {
  //        console.error(`Failed to fetch Clerk user details for ${userId}:`, fetchError);
  //        return NextResponse.json({ error: 'Could not retrieve user details' }, { status: 500 });
  //    }
  // }

  if (!userEmail) {
       console.error(`User email not found for Clerk user ID: ${userId}`);
       // Ensure userEmail has a fallback or throw error
       // For now, returning an error if email is strictly required.
       return NextResponse.json({ error: 'User email could not be determined' }, { status: 400 });
  }

  const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  let priceId: string;
  let communitySlug: string;
  let circleSpaceId: number;

  try {
    const body = await request.json();
    priceId = body.priceId;
    communitySlug = body.communitySlug; // Expect this from frontend
    circleSpaceId = body.circleSpaceId; // Expect this from frontend

    if (!priceId || !communitySlug || !circleSpaceId || typeof circleSpaceId !== 'number') {
      return NextResponse.json({ error: 'Price ID (string), Community Slug (string), and Circle Space ID (number) are required' }, { status: 400 });
    }

    // Create Stripe Checkout Session using the determined userEmail
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: userEmail, // Use the determined email
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      // Include relevant info in success URL for provisioning page
      success_url: `${origin}/payment-success?session_id={CHECKOUT_SESSION_ID}&spaceId=${circleSpaceId}&communitySlug=${communitySlug}`,
      // Redirect back to the specific community subscription page on cancel
      cancel_url: `${origin}/subscribe/${communitySlug}?cancelled=true`,
      // Pass Clerk User ID for linking in success page or webhook
      client_reference_id: userId,
      // Metadata is useful for webhooks (if implemented later)
      metadata: {
          userId: userId,
          spaceId: circleSpaceId.toString(), // Metadata values must be strings
          priceId: priceId,
          communitySlug: communitySlug,
      }
    });

    // Return session ID and the checkout URL
    return NextResponse.json({ sessionId: session.id, url: session.url });

  } catch (error) {
    console.error('Error creating checkout session:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Could not create checkout session: ${errorMessage}` }, { status: 500 });
  }
} 