'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function SuccessPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customerEmail, setCustomerEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setError('No session ID found in the URL.');
      setIsLoading(false);
      return;
    }

    const verifySession = async () => {
      try {
        // Optional: Verify session status on the backend
        // In a real app, you might want to fetch session details from your server
        // to confirm payment and potentially update user status in your DB.
        // For this basic example, we'll just show a success message.
        console.log('Stripe Checkout Session ID:', sessionId);
        // Fake loading state for demo
        await new Promise(resolve => setTimeout(resolve, 500)); 
        setCustomerEmail('example@email.com'); // Placeholder
      } catch (err) {
        console.error('Error verifying session:', err);
        setError('Failed to verify subscription status.');
      } finally {
        setIsLoading(false);
      }
    };

    verifySession();
  }, [sessionId]);

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 text-center">
        <p>Verifying your subscription...</p>
        {/* Add a loading spinner here if desired */}
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4 text-center text-red-600">
        <h1 className="text-2xl font-bold mb-4">Subscription Error</h1>
        <p>{error}</p>
        <Link href="/checkout" className="text-blue-500 hover:underline mt-4 block">
          Try subscribing again
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 text-center">
      <h1 className="text-2xl font-bold text-green-600 mb-4">Subscription Successful!</h1>
      <p>Thank you for subscribing!</p>
      {customerEmail && <p>A confirmation has been sent to {customerEmail}.</p>}
      <p className="mt-2">Your Session ID: <code className="bg-gray-200 p-1 rounded text-sm">{sessionId}</code></p>
      <Link href="/" className="text-blue-500 hover:underline mt-4 block">
        Go to Homepage
      </Link>
    </div>
  );
} 