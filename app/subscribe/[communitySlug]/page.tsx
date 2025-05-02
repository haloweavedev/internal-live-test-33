'use client'; // Needs client-side interaction for Stripe

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { toast } from "sonner"; // For notifications
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Interface matching the data from /api/get-communities
interface CommunitySubscriptionDetails {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    circleSpaceId: number;
    stripePriceIdMonthly: string | null;
    stripePriceIdAnnually: string | null;
}

// Interface for price data
interface PriceData {
    amount: number;
    currency: string;
    interval?: string;
    formattedAmount: string;
}

// Fetch community details client-side via our API route
async function fetchCommunityDetails(slug: string): Promise<CommunitySubscriptionDetails | null> {
    try {
        const response = await fetch('/api/get-communities');
         if (!response.ok) throw new Error('Failed to fetch communities list');
         const communities: CommunitySubscriptionDetails[] = await response.json();
         const community = communities.find(c => c.slug === slug);
         if (!community) {
             console.warn(`Community with slug '${slug}' not found in fetched list.`);
             return null;
         }
         return community;

    } catch (error) {
        console.error("Error fetching community details:", error);
        toast.error(`Failed to load community details: ${(error as Error).message}`);
        return null;
    }
}

// Fetch price details from Stripe
async function fetchPriceDetails(priceId: string): Promise<PriceData | null> {
    try {
        const response = await fetch(`/api/get-stripe-price?priceId=${encodeURIComponent(priceId)}`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch price details');
        }
        
        const data = await response.json();
        if (!data.success || !data.data) {
            throw new Error(data.error || 'Invalid response from price API');
        }
        
        return data.data;
    } catch (error) {
        console.error("Error fetching price details:", error);
        toast.error(`Failed to load price details: ${(error as Error).message}`);
        return null;
    }
}

export default function SubscribePage() {
    const params = useParams();
    const router = useRouter();
    const communitySlug = params.communitySlug as string;
    const [community, setCommunity] = useState<CommunitySubscriptionDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null); // 'monthly' | 'annual' | null
    
    // State for price data
    const [monthlyPrice, setMonthlyPrice] = useState<PriceData | null>(null);
    const [annualPrice, setAnnualPrice] = useState<PriceData | null>(null);
    const [pricesLoading, setPricesLoading] = useState(false);

    useEffect(() => {
        if (communitySlug) {
            setLoading(true);
            fetchCommunityDetails(communitySlug)
                .then(data => {
                    if (!data) {
                        toast.error("Community not found or not configured for subscriptions.");
                        // Consider redirecting or showing a persistent error state
                        return;
                    }
                    setCommunity(data);
                    
                    // After getting community, fetch price details
                    setPricesLoading(true);
                    
                    // Fetch monthly price if available
                    const fetchMonthlyPromise = data.stripePriceIdMonthly 
                        ? fetchPriceDetails(data.stripePriceIdMonthly)
                        : Promise.resolve(null);
                        
                    // Fetch annual price if available
                    const fetchAnnualPromise = data.stripePriceIdAnnually
                        ? fetchPriceDetails(data.stripePriceIdAnnually)
                        : Promise.resolve(null);
                    
                    // Process both price fetches in parallel
                    return Promise.all([fetchMonthlyPromise, fetchAnnualPromise]);
                })
                .then(prices => {
                    if (prices) {
                        const [monthlyPriceData, annualPriceData] = prices;
                        setMonthlyPrice(monthlyPriceData);
                        setAnnualPrice(annualPriceData);
                    }
                })
                // Catch is handled within fetchCommunityDetails
                .finally(() => {
                    setLoading(false);
                    setPricesLoading(false);
                });
        }
    }, [communitySlug]);

    const handleCheckout = async (priceId: string | null | undefined, planType: 'monthly' | 'annual') => {
        if (!priceId) {
            toast.error(`No ${planType} price configured for this community.`);
            return;
        }
        if (!community) return; // Should not happen if button is visible

        setCheckoutLoading(planType);
        toast.info("Redirecting to payment gateway...");

        try {
            const response = await fetch('/api/checkout-sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    priceId: priceId,
                    communitySlug: community.slug,
                    communityName: community.name,
                    planType: planType,
                    circleSpaceId: community.circleSpaceId,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                let friendlyMessage = errorData.error || 'Failed to create checkout session.';
                if (response.status === 401) {
                    friendlyMessage = 'Please sign in to subscribe.';
                }
                throw new Error(friendlyMessage);
            }

            // Expecting { success: true, data: { checkoutUrl: string } } from API
            const sessionResponse = await response.json(); 

            if (!sessionResponse.success || !sessionResponse.data?.checkoutUrl) {
                 throw new Error(sessionResponse.error || 'Checkout session URL not received.');
            }

            // Redirect to Stripe Checkout using the URL from the backend
            router.push(sessionResponse.data.checkoutUrl); // Use checkoutUrl

        } catch (error) {
            console.error('Checkout error:', error);
            toast.error(`Checkout failed: ${(error as Error).message}`);
            setCheckoutLoading(null);
        }
    };

    if (loading) return <div className="container mx-auto p-4 text-center"><p>Loading community details...</p></div>;
    
    if (!community) return (
        <div className="container mx-auto p-4 text-center">
             <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Community Not Found</AlertTitle>
                <AlertDescription>The community you are looking for could not be found or is not available for subscription.</AlertDescription>
             </Alert>
        </div>
    );

    // Format the price display with loading state and fallbacks
    const formatPriceDisplay = (priceData: PriceData | null, loading: boolean, type: 'monthly' | 'annual') => {
        if (loading) return "Loading price...";
        if (!priceData) return type === 'monthly' ? "Monthly plan not available" : "Annual plan not available";
        
        if (type === 'monthly') {
            return `${priceData.formattedAmount} / month`;
        }
        
        return `${priceData.formattedAmount} / year`;
    };

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-3xl font-bold mb-4">Subscribe to {community.name}</h1>
            <p className="text-muted-foreground mb-6">{community.description || 'Join our community!'}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Monthly Plan Card */} 
                <Card className={!community.stripePriceIdMonthly ? "opacity-50 pointer-events-none" : ""}>
                    <CardHeader>
                        <CardTitle>Monthly Plan</CardTitle>
                        <CardDescription>Access all content on a monthly basis.</CardDescription>
                        <p className="text-2xl font-semibold pt-2">
                            {formatPriceDisplay(monthlyPrice, pricesLoading, 'monthly')}
                        </p> 
                    </CardHeader>
                    <CardContent>
                        <Button
                            className="w-full"
                            onClick={() => handleCheckout(community.stripePriceIdMonthly, 'monthly')}
                            disabled={!!checkoutLoading || !community.stripePriceIdMonthly || pricesLoading}
                        >
                            {checkoutLoading === 'monthly' ? 'Processing...' : 'Subscribe Monthly'}
                        </Button>
                    </CardContent>
                </Card>

                {/* Annual Plan Card */} 
                <Card className={!community.stripePriceIdAnnually ? "opacity-50 pointer-events-none" : ""}>
                    <CardHeader>
                        <CardTitle>Annual Plan</CardTitle>
                        <CardDescription>Save money with an annual subscription.</CardDescription>
                        <p className="text-2xl font-semibold pt-2">
                            {formatPriceDisplay(annualPrice, pricesLoading, 'annual')}
                        </p> 
                    </CardHeader>
                    <CardContent>
                         <Button
                            className="w-full"
                            onClick={() => handleCheckout(community.stripePriceIdAnnually, 'annual')}
                            disabled={!!checkoutLoading || !community.stripePriceIdAnnually || pricesLoading}
                        >
                            {checkoutLoading === 'annual' ? 'Processing...' : 'Subscribe Annually'}
                        </Button>
                    </CardContent>
                </Card>
            </div>
             {/* TODO: Add Discount Code Input later */} 
        </div>
    );
} 