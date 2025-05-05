'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { z } from 'zod'; // For validation

// Define Zod schema for input validation
const UpdateCommunitySchema = z.object({
    communityId: z.number().int().positive(),
    circleSpaceId: z.number().int().positive(), // Remove nullable, must be a positive integer
    stripePriceIdMonthly: z.string().startsWith('price_').nullable().or(z.literal('')), // Allow null or empty string
    stripePriceIdAnnually: z.string().startsWith('price_').nullable().or(z.literal('')), // Allow null or empty string
});

// Define return type for better type safety
type ActionResult = {
    success: boolean;
    error?: string;
    errors?: Record<string, string | undefined>; // For field-specific errors
};

// Basic Admin Check (duplicate or import from admin page - import preferred)
// TODO: Refactor for production: Replace .env email check with Clerk roles/metadata.
async function isAdminServerAction(): Promise<boolean> {
    const { userId, sessionClaims } = await auth();
    if (!userId) return false;

    const adminEmails = (process.env.ADMIN_EMAILS || "").split(',').map(e => e.trim()).filter(e => e);
    // Explicitly check that email is a string before using it with includes
    const userEmail = typeof sessionClaims?.email === 'string' ? sessionClaims.email : undefined;

    // Fallback to fetching user if email not in claims (less efficient)
    // const user = await clerkClient.users.getUser(userId);
    // const userEmail = user?.primaryEmailAddress?.emailAddress;

    return userEmail ? adminEmails.includes(userEmail) : false;
}


export async function updateCommunityConfiguration(
    input: z.infer<typeof UpdateCommunitySchema>
): Promise<ActionResult> {
    // 1. Authorization Check
    const { userId } = await auth(); // Get user ID again for server-side check
    if (!userId || !(await isAdminServerAction())) {
        return { success: false, error: 'Unauthorized.' };
    }

    // 2. Validate Input
    const validationResult = UpdateCommunitySchema.safeParse(input);
    if (!validationResult.success) {
         console.error("Admin Update Validation Error:", validationResult.error.flatten().fieldErrors);
         // Return field-specific errors if needed by the form
         return {
             success: false,
             error: "Invalid input data.",
             errors: validationResult.error.flatten().fieldErrors as Record<string, string | undefined>
         };
    }

    const { communityId, circleSpaceId, stripePriceIdMonthly, stripePriceIdAnnually } = validationResult.data;

    // 3. Perform Database Update
    try {
        await prisma.community.update({
            where: { id: communityId },
            data: {
                circleSpaceId: circleSpaceId, // Now guaranteed to be a number (not null)
                // Convert empty strings to null before saving
                stripePriceIdMonthly: stripePriceIdMonthly || null,
                stripePriceIdAnnually: stripePriceIdAnnually || null,
            },
        });

        console.log(`Admin ${userId} updated community ${communityId} config.`);

        // 4. Revalidate Path
        revalidatePath('/admin'); // Revalidate the admin page to show updated data
        revalidatePath('/spaces'); // Revalidate the public spaces page
        revalidatePath(`/subscribe/${(await prisma.community.findUnique({ where: { id: communityId }, select: { slug: true } }))?.slug}`); // Revalidate specific subscribe page

        return { success: true };

    } catch (error: unknown) {
        console.error(`Failed to update community ${communityId}:`, error);
        
        // Check for specific Prisma errors in a more type-safe way
        if (
            error instanceof Error && 
            typeof error === 'object' && 
            error !== null &&
            'code' in error && 
            error.code === 'P2002' && 
            'meta' in error && 
            error.meta !== null &&
            typeof error.meta === 'object' &&
            'target' in error.meta
        ) {
            // It's a Prisma unique constraint violation
            const target = error.meta.target;
            const field = Array.isArray(target) ? target.join(', ') : 'field';
            return { 
                success: false, 
                error: `Failed to update: The value provided for ${field} is already in use by another community.` 
            };
        }
        
        // For any other error
        return { 
            success: false, 
            error: error instanceof Error ? error.message : 'Database error during update.' 
        };
    }
} 