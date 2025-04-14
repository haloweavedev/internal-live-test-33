'use client';

import { loadStripe } from '@stripe/stripe-js';

const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

if (!stripePublishableKey) {
  throw new Error('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set in .env');
}

// Make sure to call `loadStripe` outside of a component's render to avoid
// recreating the `Stripe` object on every render.
const stripePromise = loadStripe(stripePublishableKey);

// TODO: Replace with your actual Stripe Price ID
const SUBSCRIPTION_PRICE_ID = 'price_1234567890';

export default function CheckoutPage() {
  const handleCheckout = async (priceId: string) => {
    if (!priceId) {
      alert('Please select a subscription plan.');
      return;
    }

    try {
      // Create a Checkout Session on the server
      const response = await fetch('/api/checkout-sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ priceId: priceId }), // Send the selected price ID
      });

      if (!response.ok) {
        // Handle server errors
        console.error('Server error:', response.status, await response.text());
        alert('Failed to create checkout session.');
        return;
      }

      const session = await response.json();

      // Redirect to Stripe Checkout
      const stripe = await stripePromise;
      if (!stripe) {
        console.error('Stripe.js has not loaded yet.');
        alert('Payment system is not ready. Please try again later.');
        return;
      }

      const { error } = await stripe.redirectToCheckout({
        sessionId: session.sessionId,
      });

      if (error) {
        console.error('Stripe redirection error:', error);
        alert(error.message || 'An error occurred during redirection to payment.');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('An unexpected error occurred.');
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Subscribe to our Plan</h1>
      <div className="border p-4 rounded shadow">
        <h2 className="text-xl mb-2">Premium Plan</h2>
        <p className="mb-4">Get access to all premium features.</p>
        {/* In a real app, you would fetch plans and map over them */}
        <button
          type="button"
          onClick={() => handleCheckout(SUBSCRIPTION_PRICE_ID)}
          className="bg-purple-600 hover:bg-purple-800 text-white font-bold py-2 px-4 rounded"
        >
          Subscribe Now
        </button>
      </div>
    </div>
  );
} 