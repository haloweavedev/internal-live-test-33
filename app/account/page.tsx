import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ManageBillingButton from './manage-billing-button';

// Define type for subscription
interface Subscription {
  id: string;
  status: string;
  planType: string | null;
  endDate: Date | null;
  community: {
    name: string;
    slug: string;
    circleSpaceId?: number | null;
  };
}

export default async function AccountPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect('/sign-in?redirect_url=/account');
  }

  const userWithSubscriptions = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      stripeCustomerId: true, // Needed for Billing Portal button logic
      subscriptions: {
        select: {
          id: true,
          status: true,
          planType: true,
          endDate: true,
          createdAt: true, // Added for context
          community: {
            select: {
              name: true,
              slug: true,
              circleSpaceId: true
            }
          }
        },
        orderBy: { createdAt: 'desc' } // Show most recent first
      }
    }
  });

  if (!userWithSubscriptions) {
    console.error(`User ${userId} authenticated but not found in DB for account page.`);
    // Optional: Add a user-friendly error display component
    return <div className="container mx-auto p-4">Error: User data not found. Please contact support.</div>;
  }

  const hasStripeCustomerId = !!userWithSubscriptions.stripeCustomerId;
  const activeSubscriptions = userWithSubscriptions.subscriptions.filter((sub: Subscription) => ['active', 'past_due'].includes(sub.status)); // Filter for relevant subs

  return (
    <div className="container mx-auto py-8 px-4 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Your Account</h1>
        <p className="text-muted-foreground">Manage your subscriptions and billing information.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Subscriptions</CardTitle>
          <CardDescription>Your current community memberships.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeSubscriptions.length === 0 && (
            <p className="text-muted-foreground italic">You have no active subscriptions.</p>
          )}
          {activeSubscriptions.map((sub: Subscription) => (
            <div key={sub.id} className="flex justify-between items-center border-b pb-2 last:border-b-0">
              <div>
                <p className="font-semibold">{sub.community.name}</p>
                <p className="text-sm text-muted-foreground">Plan: {sub.planType || 'N/A'}</p>
                {sub.endDate && sub.status === 'active' && (
                  <p className="text-sm text-orange-600">Cancels on: {new Date(sub.endDate).toLocaleDateString()}</p>
                )}
              </div>
              <Badge variant={sub.status === 'active' ? 'default' : 'secondary'}>{sub.status}</Badge>
            </div>
          ))}
        </CardContent>
        {/* Conditionally render Manage Billing Button */}
        {hasStripeCustomerId && activeSubscriptions.length > 0 && (
          <CardFooter>
            <ManageBillingButton />
          </CardFooter>
        )}
        {!hasStripeCustomerId && activeSubscriptions.length > 0 && (
          <CardFooter>
            <p className="text-sm text-muted-foreground">Billing management link unavailable (Missing Stripe ID). Please contact support.</p>
          </CardFooter>
        )}
      </Card>

      {/* Optional: Section for past/canceled subscriptions */}
      {/*
      <Card>
        <CardHeader>...</CardHeader>
        <CardContent>... list canceled subs ...</CardContent>
      </Card>
      */}

    </div>
  );
} 