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

// Add the Community interface at the top of the file
interface Community {
  id: number;
  name: string;
  slug: string;
  circleSpaceId: number;
  description?: string | null;
  imageUrl?: string | null;
}

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
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-4xl mx-auto mb-12 text-center">
        <h1 className="text-4xl font-bold mb-4">Explore Our Communities</h1>
        <p className="text-lg text-muted-foreground">
          Discover and join specialized spaces for Irish professionals and enthusiasts.
        </p>
      </div>
      
      {communities.length === 0 && (
        <div className="bg-card border rounded-lg p-6 max-w-md mx-auto text-center">
          <p className="text-muted-foreground">
            No communities are available at this time. Check back later!
          </p>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {communities.map((community: Community) => {
          const isSubscribed = subscribedCommunityIds.has(community.id);
          const spaceUrl = `/platform-space/${community.circleSpaceId}`;
          const subscribeUrl = `/subscribe/${community.slug}`;
          const signInUrl = "/sign-in?redirect_url=/spaces";
          
          return (
            <Card key={community.id} className="flex flex-col h-full overflow-hidden transition-all duration-200 hover:shadow-md">
              <CardHeader className="p-0">
                {community.imageUrl ? (
                  <div className="relative w-full aspect-video">
                    <Image
                      src={community.imageUrl}
                      alt={community.name || 'Community Image'}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                  </div>
                ) : (
                  <div className="w-full aspect-video bg-secondary flex items-center justify-center">
                    <span className="text-muted-foreground">No Image</span>
                  </div>
                )}
              </CardHeader>
              
              <CardContent className="flex-grow p-6">
                <CardTitle className="text-xl font-semibold mb-3">{community.name}</CardTitle>
                <CardDescription className="text-sm text-muted-foreground line-clamp-3">
                  {community.description || 'Join this community to learn more about what it offers.'}
                </CardDescription>
              </CardContent>
              
              <CardFooter className="p-6 pt-0">
                {isAuthenticated ? (
                  isSubscribed ? (
                    <Button asChild className="w-full">
                      <Link href={spaceUrl}>
                        Go to Space
                      </Link>
                    </Button>
                  ) : (
                    <Button asChild variant="secondary" className="w-full">
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