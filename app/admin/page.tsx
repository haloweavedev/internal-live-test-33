// app/admin/page.tsx (Server Component)
import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma'; // Use the Prisma client utility
import {
    Table,
    TableBody,
    TableCaption, // Optional: Add a caption
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from 'lucide-react'; // For Alert icon
import EditCommunityButton from './edit-community-button'; // Import the EditCommunityButton component

// Define user type at the top of the file
interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
  circleCommunityMemberId?: number | null;
  subscriptions: Array<{
    status: string;
    planType: string | null;
    community: {
      name: string;
      slug: string;
    }
  }>;
}

// Add more interface definitions
interface Community {
  id: number;
  name: string;
  slug: string;
  circleSpaceId: number;
  stripePriceIdMonthly: string | null;
  stripePriceIdAnnually: string | null;
  createdAt: Date;
}

interface DetailedSubscription {
  id: string;
  status: string;
  planType: string | null;
  createdAt: Date;
  endDate: Date | null;
  user: {
    email: string;
    name: string | null;
  };
  community: {
    name: string;
  };
}

// TODO: Refactor for production: Replace .env email check with Clerk roles/metadata for better scalability and security.
// See Clerk documentation on Roles or Public/Private Metadata.
async function isAdmin(userId: string): Promise<boolean> {
    // In a real app, check Clerk roles/metadata or a flag in your DB
    // For demo, allow specific user IDs or check email domain from env
    const adminEmails = (process.env.ADMIN_EMAILS || "").split(',').map(e => e.trim()).filter(e => e);
    if (adminEmails.length === 0) {
        console.warn("ADMIN_EMAILS environment variable is not set. No users will be considered admin.");
        return false;
    }

    // Fetch user email using Clerk
    const user = await currentUser();
    const userEmail = user?.primaryEmailAddress?.emailAddress;

    // Check if the current user matches the calling userId and if their email is in the admin list
    return user?.id === userId && userEmail ? adminEmails.includes(userEmail) : false;
}

export default async function AdminPage() {
    const { userId } = await auth();

    // Authentication & Authorization check
    if (!userId) {
        redirect('/sign-in'); // Redirect if not logged in
    }
    if (!(await isAdmin(userId))) {
        // Redirect to homepage or show an unauthorized message if not admin
        console.warn(`User ${userId} attempted to access admin page without authorization.`);
        redirect('/');
    }

    // Fetch users from the database
    const users = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
            subscriptions: { // Include subscriptions to show status
                select: {
                    status: true,
                    planType: true, // Include plan type
                    community: { select: { name: true, slug: true } } // Include community name and slug
                },
                orderBy: { community: { name: 'asc' } } // Order subscriptions alphabetically by community name
            }
        }
    });

    // Fetch communities from the database
    const communities = await prisma.community.findMany({
        orderBy: { name: 'asc' },
        select: {
            id: true,
            name: true,
            slug: true,
            circleSpaceId: true,
            stripePriceIdMonthly: true,
            stripePriceIdAnnually: true,
            createdAt: true
        }
    });

    // Fetch all subscriptions with related user and community info
    const allSubscriptions = await prisma.subscription.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
            user: { select: { email: true, name: true } },
            community: { select: { name: true } }
        }
    });

    return (
        <div className="space-y-12 pb-10">
            <div>
                <h1 className="text-2xl font-bold mb-6">Admin - Platform Users</h1>
                <Alert className="mb-6">
                    <Terminal className="h-4 w-4" />
                    <AlertTitle>Platform User Overview</AlertTitle>
                    <AlertDescription>
                        This table lists users registered on the platform via Clerk and synced/created during provisioning.
                        Future enhancements could include Circle status checks and manual access controls.
                    </AlertDescription>
                </Alert>

                <div className="border rounded-lg">
                    <Table>
                        <TableCaption>A list of registered platform users and their community subscriptions.</TableCaption>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[250px]">Email</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Platform Signup</TableHead>
                                <TableHead>Circle ID</TableHead>
                                <TableHead className="text-right">Subscriptions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center text-muted-foreground">No users found.</TableCell>
                                </TableRow>
                            )}
                            {users.map((user: User) => (
                                <TableRow key={user.id}>
                                    <TableCell className="font-medium">{user.email}</TableCell>
                                    <TableCell>{user.name || '-'}</TableCell>
                                    <TableCell>{user.createdAt.toLocaleDateString()}</TableCell>
                                    <TableCell>{user.circleCommunityMemberId || 'N/A'}</TableCell>
                                    <TableCell className="text-right space-x-1 space-y-1">
                                        {user.subscriptions.length > 0 ? (
                                            user.subscriptions.map(sub => (
                                                <Badge
                                                    key={sub.community.slug}
                                                    variant={sub.status === 'active' ? 'default' : (sub.status === 'provisioning_failed' ? 'destructive' : 'secondary')}
                                                    className="whitespace-nowrap"
                                                >
                                                    {sub.community.name}: {sub.status} ({sub.planType || 'N/A'})
                                                </Badge>
                                            ))
                                        ) : (
                                            <Badge variant="outline">None</Badge>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                {/* TODO: Add Manual Access Grant/Revoke Forms Here Later */} 
            </div>

            {/* Communities Table */}
            <div>
                <h2 className="text-2xl font-bold mb-6">Configured Communities</h2>
                <div className="border rounded-lg">
                    <Table>
                        <TableCaption>Communities configured on the platform with their Circle and Stripe connections.</TableCaption>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Slug</TableHead>
                                <TableHead>Circle Space ID</TableHead>
                                <TableHead>Stripe Monthly Price ID</TableHead>
                                <TableHead>Stripe Annual Price ID</TableHead>
                                <TableHead>Created Date</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {communities.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center text-muted-foreground">No communities found.</TableCell>
                                </TableRow>
                            )}
                            {communities.map((community: Community) => (
                                <TableRow key={community.id}>
                                    <TableCell className="font-medium">{community.name}</TableCell>
                                    <TableCell>{community.slug}</TableCell>
                                    <TableCell>{community.circleSpaceId}</TableCell>
                                    <TableCell>{community.stripePriceIdMonthly || 'Not Set'}</TableCell>
                                    <TableCell>{community.stripePriceIdAnnually || 'Not Set'}</TableCell>
                                    <TableCell>{community.createdAt.toLocaleDateString()}</TableCell>
                                    <TableCell className="text-right">
                                        <EditCommunityButton community={community} />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Subscriptions Table */}
            <div>
                <h2 className="text-2xl font-bold mb-6">All Subscriptions</h2>
                <div className="border rounded-lg">
                    <Table>
                        <TableCaption>Detailed view of all user subscriptions in the system.</TableCaption>
                        <TableHeader>
                            <TableRow>
                                <TableHead>User Email</TableHead>
                                <TableHead>User Name</TableHead>
                                <TableHead>Community Name</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Plan Type</TableHead>
                                <TableHead>Start Date</TableHead>
                                <TableHead>End Date</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {allSubscriptions.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center text-muted-foreground">No subscriptions found.</TableCell>
                                </TableRow>
                            )}
                            {allSubscriptions.map((subscription: DetailedSubscription) => (
                                <TableRow key={subscription.id}>
                                    <TableCell className="font-medium">{subscription.user.email}</TableCell>
                                    <TableCell>{subscription.user.name || '-'}</TableCell>
                                    <TableCell>{subscription.community.name}</TableCell>
                                    <TableCell>
                                        <Badge
                                            variant={
                                                subscription.status === 'active' ? 'default' :
                                                subscription.status === 'canceled' ? 'secondary' :
                                                subscription.status === 'past_due' ? 'secondary' :
                                                subscription.status === 'access_revocation_failed' ? 'destructive' :
                                                subscription.status === 'provisioning_failed' ? 'destructive' :
                                                'outline'
                                            }
                                        >
                                            {subscription.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{subscription.planType || 'N/A'}</TableCell>
                                    <TableCell>{subscription.createdAt.toLocaleDateString()}</TableCell>
                                    <TableCell>{subscription.endDate ? subscription.endDate.toLocaleDateString() : '-'}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
} 