'use client';

// app/payment-success/page.tsx (Client Component)
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

function PaymentSuccessContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    // Extract params from URL
    const sessionId = searchParams.get('session_id');
    const spaceIdStr = searchParams.get('spaceId');
    const communitySlug = searchParams.get('communitySlug');

    useEffect(() => {
        let spaceId: number | null = null;

        if (!sessionId) {
            setError("Missing checkout session ID.");
            setIsLoading(false);
            return;
        }
        
        if (!spaceIdStr || Number.isNaN(Number.parseInt(spaceIdStr, 10))) { 
            setError("Missing or invalid space identifier.");
            setIsLoading(false);
            return;
        }
        
        spaceId = Number.parseInt(spaceIdStr, 10);
        
        if (!communitySlug) {
            setError("Missing community identifier.");
            setIsLoading(false);
            return;
        }

        // Call the API endpoint to handle verification and provisioning
        const verifyAndProvision = async () => {
            try {
                const response = await fetch('/api/provision-access', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        sessionId,
                        spaceId,
                        communitySlug
                    }),
                });

                const data = await response.json();

                if (data.success) {
                    // Redirect on success
                    router.push(`/platform-space/${spaceId}`);
                } else {
                    setError(data.error || 'Failed to provision access');
                    setIsLoading(false);
                }
            } catch (err) {
                console.error('Error provisioning access:', err);
                setError('An unexpected error occurred while processing your payment');
                setIsLoading(false);
            }
        };

        verifyAndProvision();
    }, [sessionId, spaceIdStr, communitySlug, router]);

    // Loading state
    if (isLoading) {
        return (
            <div className="container mx-auto p-4 flex flex-col items-center justify-center min-h-[60vh]">
                <div className="text-center">
                    <h2 className="text-2xl font-bold mb-4">Finalizing Your Subscription</h2>
                    <p className="mb-4">Please wait while we set up your access...</p>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="container mx-auto p-4 flex flex-col items-center justify-center min-h-[60vh]">
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Subscription Finalization Failed</AlertTitle>
                    <AlertDescription>
                        {error}
                        {sessionId && <p className="mt-2">Please contact support if the issue persists, mentioning session ID: {sessionId}</p>}
                    </AlertDescription>
                </Alert>
                <Button asChild variant="link" className="mt-4">
                    <Link href="/">Return to Homepage</Link>
                </Button>
            </div>
        );
    }

    // This shouldn't be reached due to the redirects, but including for completeness
    return null;
}

export default function PaymentSuccessPage() {
    return (
        <Suspense fallback={
            <div className="container mx-auto p-4 flex flex-col items-center justify-center min-h-[60vh]">
                <div className="text-center">
                    <h2 className="text-2xl font-bold mb-4">Loading payment details...</h2>
                </div>
            </div>
        }>
            <PaymentSuccessContent />
        </Suspense>
    );
} 