'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react'; // For loading spinner

export default function ManageBillingButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleManageBilling = async () => {
    setIsLoading(true);
    toast.info('Redirecting to billing portal...');
    try {
      const response = await fetch('/api/billing-portal', {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create billing portal session.');
      }

      const sessionData = await response.json();

      if (!sessionData.success || !sessionData.data?.portalUrl) {
         throw new Error(sessionData.error || 'Billing portal URL not received.');
      }

      // Redirect to the Stripe Billing Portal URL
      router.push(sessionData.data.portalUrl);
      // No need to setIsLoading(false) as we are navigating away

    } catch (error) {
      console.error('Error creating billing portal session:', error);
      toast.error(`Error: ${(error as Error).message}`);
      setIsLoading(false); // Reset loading state on error
    }
  };

  return (
    <Button onClick={handleManageBilling} disabled={isLoading} className="w-full sm:w-auto">
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Redirecting...
        </>
      ) : (
        'Manage Billing & Subscriptions'
      )}
    </Button>
  );
} 