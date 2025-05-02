import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import Stripe from 'stripe';

// Initialize Stripe client
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, { typescript: true }) : null;

export async function GET(request: NextRequest) {
  // Get priceId from search params
  const searchParams = request.nextUrl.searchParams;
  const priceId = searchParams.get('priceId');

  // Verify Stripe is configured
  if (!stripe) {
    console.error('Stripe configuration error: Secret key is missing');
    return NextResponse.json({ 
      success: false, 
      error: 'Stripe configuration error.' 
    }, { status: 500 });
  }

  // Validate the priceId parameter
  if (!priceId || typeof priceId !== 'string') {
    return NextResponse.json({ 
      success: false, 
      error: 'Missing or invalid priceId parameter' 
    }, { status: 400 });
  }

  try {
    // Retrieve the price from Stripe
    const price = await stripe.prices.retrieve(priceId);

    // Handle case where price is not found (should be caught by Stripe's error)
    if (!price) {
      return NextResponse.json({ 
        success: false, 
        error: 'Price not found' 
      }, { status: 404 });
    }

    // Extract the amount and ensure it's in the right format
    const amount = price.unit_amount || 0;
    const currency = price.currency || 'usd';
    
    // Extract the interval from the recurring object if it exists
    const interval = price.recurring?.interval;

    // Format the amount for display (from cents to dollars for currency like USD)
    const formattedAmount = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount / 100);

    return NextResponse.json({ 
      success: true, 
      data: {
        amount,
        currency,
        interval,
        formattedAmount
      }
    });

  } catch (error) {
    console.error('Error retrieving price from Stripe:', error);
    
    // Handle Stripe API errors
    let errorMessage = 'Failed to retrieve price information.';
    let status = 500;

    // If it's a Stripe error, extract the message
    if (error instanceof Stripe.errors.StripeError) {
      errorMessage = error.message;
      
      // Set appropriate status code
      if (error.type === 'StripeInvalidRequestError') {
        status = 404; // Not found or invalid ID
      }
    }

    return NextResponse.json({ 
      success: false, 
      error: errorMessage 
    }, { status });
  }
} 