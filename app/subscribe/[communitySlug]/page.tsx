'use client'; // Needs client-side interaction for Stripe

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { toast } from "sonner"; // For notifications
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

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

    if (loading) return (
        <div className="container max-w-3xl mx-auto p-8 text-center">
            <Skeleton className="h-8 w-56 mx-auto mb-4" />
            <Skeleton className="h-4 w-full max-w-md mx-auto mb-16" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Skeleton className="h-64 w-full rounded-lg" />
                <Skeleton className="h-64 w-full rounded-lg" />
            </div>
        </div>
    );
    
    if (!community) return (
        <div className="container max-w-3xl mx-auto p-8 text-center">
             <Alert variant="destructive" className="max-w-md mx-auto">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Community Not Found</AlertTitle>
                <AlertDescription>The community you are looking for could not be found or is not available for subscription.</AlertDescription>
             </Alert>
        </div>
    );

    return (
        <div className="container max-w-5xl mx-auto py-12 px-4">
            <div className="text-center mb-12">
                <h1 className="text-3xl md:text-4xl font-bold mb-4">Subscribe to {community.name}</h1>
                <p className="text-muted-foreground max-w-2xl mx-auto">{community.description || 'Join our community to access exclusive content and connect with like-minded individuals.'}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
                {/* Monthly Plan Card */} 
                <Card className={`overflow-hidden ${!community.stripePriceIdMonthly ? "opacity-50 pointer-events-none" : ""}`}>
                    <CardHeader className="pb-4">
                        <CardTitle className="text-2xl">Monthly Membership</CardTitle>
                        <CardDescription className="mt-1">Pay month-to-month, cancel anytime.</CardDescription>
                        <div className="mt-4">
                            {pricesLoading ? (
                                <Skeleton className="h-10 w-32" />
                            ) : (
                                <div className="flex items-end">
                                    <span className="text-3xl font-bold">
                                        {monthlyPrice?.formattedAmount}
                                    </span>
                                    <span className="text-muted-foreground ml-1 mb-1">/month</span>
                                </div>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <ul className="space-y-2 text-sm">
                            <li className="flex items-center">
                                <svg className="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                                Full access to all community content
                            </li>
                            <li className="flex items-center">
                                <svg className="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                                Participation in member discussions
                            </li>
                            <li className="flex items-center">
                                <svg className="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                                Monthly billing with easy cancellation
                            </li>
                        </ul>
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
                <Card className={`overflow-hidden ${!community.stripePriceIdAnnually ? "opacity-50 pointer-events-none" : ""}`}>
                    <CardHeader className="pb-4 relative">
                        {community.stripePriceIdAnnually && monthlyPrice && annualPrice && (
                            <Badge className="absolute top-4 right-4" variant="secondary">Best Value</Badge>
                        )}
                        <CardTitle className="text-2xl">Annual Membership</CardTitle>
                        <CardDescription className="mt-1">Save with our annual plan.</CardDescription>
                        <div className="mt-4">
                            {pricesLoading ? (
                                <Skeleton className="h-10 w-32" />
                            ) : (
                                <div className="flex items-end">
                                    <span className="text-3xl font-bold">
                                        {annualPrice?.formattedAmount}
                                    </span>
                                    <span className="text-muted-foreground ml-1 mb-1">/year</span>
                                </div>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <ul className="space-y-2 text-sm">
                            <li className="flex items-center">
                                <svg className="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                                Full access to all community content
                            </li>
                            <li className="flex items-center">
                                <svg className="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                                Participation in member discussions
                            </li>
                            <li className="flex items-center">
                                <svg className="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                                Priority access to special events
                            </li>
                            <li className="flex items-center">
                                <svg className="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                                Save with annual billing
                            </li>
                        </ul>
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