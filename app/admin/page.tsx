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

// Basic Admin Check (replace with proper role check in production)
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

    return (
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
                        {users.map(user => (
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
    );
} 