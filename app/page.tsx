// app/page.tsx (Server Component)
import prisma from '@/lib/prisma';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
// import { Badge } from '@/components/ui/badge'; // Keep commented if not used
import { auth } from '@clerk/nextjs/server';

// Define types based on the Prisma schema (as established)
interface Community {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    imageUrl: string | null;
    circleSpaceId: number;
    // Add other fields if needed by the component, e.g., price IDs
}

interface SubscriptionWithCommunityId {
    communityId: number;
}

// Fetch communities and user's subscriptions server-side
async function getData() {
    // Get auth info but don't fail if user is not authenticated
    const { userId } = await auth() || { userId: null };
    
    const communities = await prisma.community.findMany({
        orderBy: { name: 'asc' },
        // Select only the fields needed by the component
        select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            imageUrl: true,
            circleSpaceId: true,
        }
    }) as Community[]; // Cast to our local interface

    let userSubscriptions: SubscriptionWithCommunityId[] = [];
    if (userId) {
        userSubscriptions = await prisma.subscription.findMany({
            where: { userId: userId, status: 'active' }, // Only care about active subs
            select: { communityId: true } // Select only needed field
        });
    }
    const subscribedCommunityIds = new Set(userSubscriptions.map(sub => sub.communityId));
    return { communities, subscribedCommunityIds, isAuthenticated: !!userId };
}

export default async function HomePage() {
    const { communities, subscribedCommunityIds, isAuthenticated } = await getData();

    return (
        <div className="container mx-auto py-8 px-4">
            <h1 className="text-3xl font-bold mb-6 text-center sm:text-left">Explore Our Communities</h1>
            {communities.length === 0 && <p className="text-center text-muted-foreground">No communities available yet.</p>}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {communities.map((community) => {
                    const isSubscribed = subscribedCommunityIds.has(community.id);
                    return (
                        <Card key={community.id} className="flex flex-col overflow-hidden">
                            <CardHeader className="p-0">
                                {community.imageUrl ? (
                                    <div className="relative h-48 w-full">
                                        <Image
                                            src={community.imageUrl}
                                            alt={community.name ?? 'Community Image'}
                                            fill
                                            style={{ objectFit: 'cover' }}
                                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                            priority={false}
                                        />
                                    </div>
                                ) : (
                                    <div className="h-48 w-full bg-secondary flex items-center justify-center">
                                        <span className="text-muted-foreground">No Image</span>
                                    </div>
                                )}
                             </CardHeader>
                             <CardContent className="p-4 flex-grow">
                                <CardTitle className="mb-2">{community.name}</CardTitle>
                                <CardDescription>{community.description || 'No description available.'}</CardDescription>
                             </CardContent>
                             <CardFooter className="p-4">
                                {isAuthenticated ? (
                                    isSubscribed ? (
                                        <Link href={`/platform-space/${community.circleSpaceId}`} className="w-full">
                                            <Button className="w-full" variant="outline">Go to Space</Button>
                                        </Link>
                                    ) : (
                                        <Link href={`/subscribe/${community.slug}`} className="w-full">
                                            <Button className="w-full">View Plans</Button>
                                        </Link>
                                    )
                                ) : (
                                    <Link href={`/sign-in?redirect_url=/subscribe/${community.slug}`} className="w-full">
                                        <Button className="w-full">Sign in to View Plans</Button>
                                    </Link>
                                )}
                            </CardFooter>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}