import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import Image from 'next/image';
import Link from 'next/link';
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent,
  CardFooter 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// Data fetching function
async function getData() {
  // Get current user's auth state
  const { userId } = await auth();
  const isAuthenticated = !!userId;
  
  // Fetch communities from database
  const communities = await prisma.community.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      imageUrl: true,
      circleSpaceId: true,
      stripePriceIdMonthly: true,
      stripePriceIdAnnually: true,
    }
  });
  
  // If authenticated, get user's active subscriptions
  const subscribedCommunityIds = new Set<number>();
  if (isAuthenticated) {
    const subscriptions = await prisma.subscription.findMany({
      where: {
        userId: userId,
        status: 'active',
      },
      select: {
        communityId: true,
      }
    });
    
    // Add subscribed community IDs to the Set for easy lookup
    for (const sub of subscriptions) {
      subscribedCommunityIds.add(sub.communityId);
    }
  }
  
  return {
    communities,
    subscribedCommunityIds,
    isAuthenticated
  };
}

export default async function SpacesPage() {
  const { communities, subscribedCommunityIds, isAuthenticated } = await getData();

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Explore Our Communities</h1>
      
      {communities.length === 0 && (
        <div className="bg-white shadow-md rounded-lg p-6">
          <p className="text-gray-600">
            No communities are available at this time.
          </p>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {communities.map(community => {
          const isSubscribed = subscribedCommunityIds.has(community.id);
          const spaceUrl = `/platform-space/${community.circleSpaceId}`;
          const subscribeUrl = `/subscribe/${community.slug}`;
          const signInUrl = "/sign-in?redirect_url=/spaces";
          
          return (
            <Card key={community.id} className="flex flex-col">
              <CardHeader className="p-0">
                {community.imageUrl ? (
                  <div className="relative h-48 w-full">
                    <Image
                      src={community.imageUrl}
                      alt={community.name || 'Community Image'}
                      fill
                      style={{ objectFit: 'cover' }}
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                  </div>
                ) : (
                  <div className="h-48 w-full bg-secondary flex items-center justify-center">
                    <span className="text-muted-foreground">No Image</span>
                  </div>
                )}
              </CardHeader>
              
              <CardContent className="flex-grow">
                <CardTitle className="text-xl mb-2">{community.name}</CardTitle>
                <CardDescription>
                  {community.description || 'Join this community to learn more.'}
                </CardDescription>
              </CardContent>
              
              <CardFooter>
                {isAuthenticated ? (
                  isSubscribed ? (
                    <Button asChild className="w-full">
                      <Link href={spaceUrl}>
                        Go to Space
                      </Link>
                    </Button>
                  ) : (
                    <Button asChild className="w-full">
                      <Link href={subscribeUrl}>
                        View Plans
                      </Link>
                    </Button>
                  )
                ) : (
                  <Button asChild className="w-full">
                    <Link href={signInUrl}>
                      Sign in to View Plans
                    </Link>
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
} 