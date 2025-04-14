import prisma from './prisma';
import { callCircleAdminApi } from './circle-admin-api';
// import crypto from 'node:crypto'; // Removed unused import
import type { User } from '@/app/generated/prisma';

/**
 * Checks if the object is a potential Circle API error response structure.
 */
function isPotentialApiErrorData(data: unknown): data is { message?: string; details?: unknown } {
    if (typeof data !== 'object' || data === null) {
        return false;
    }
    return 'message' in data;
}

/**
 * Checks if the object is an error with status code.
 */
function hasStatusCode(error: unknown): error is { status?: number } {
    return typeof error === 'object' && error !== null && 'status' in error;
}

/**
 * Provisions Circle.so access for a user after successful subscription.
 * - Creates/updates the user record if necessary (basic info from Clerk).
 * - Upserts the subscription record in the local DB.
 * - Creates/finds the user in Circle Admin API.
 * - Adds the user to the specified Circle Space.
 */
export async function provisionCircleAccess(
    platformUserId: string,
    userEmail: string,
    userName: string | null, // Add user name from Clerk
    spaceId: number,
    communityId: number, // Prisma Community ID
    stripeSubscriptionId: string,
    stripeCustomerId: string,
    planType: 'monthly' | 'annual'
): Promise<{ success: boolean; error?: string }> {
    console.log(`Provisioning access for ${userEmail} (ID: ${platformUserId}) to space ${spaceId}`);
    let userRecord: User | null = null;

    try {
        // 1. Upsert User in Platform DB (ensure user exists locally)
        // This step is crucial since we removed the Clerk webhook
        try {
            userRecord = await prisma.user.upsert({
                where: { id: platformUserId },
                update: { name: userName, email: userEmail }, // Update name/email just in case
                create: {
                    id: platformUserId,
                    email: userEmail,
                    name: userName,
                },
            });
            console.log(`User record ${userRecord.id} upserted in DB.`);
        } catch (dbError) {
            console.error(`Failed to upsert user ${platformUserId} in DB:`, dbError);
            throw new Error(`Database error during user upsert: ${(dbError as Error).message}`);
        }

        // 2. Upsert Subscription Record in Platform DB
        const subscription = await prisma.subscription.upsert({
            where: { userId_communityId: { userId: platformUserId, communityId: communityId } },
            update: {
                status: 'active',
                stripeSubscriptionId: stripeSubscriptionId,
                stripeCustomerId: stripeCustomerId,
                planType: planType,
                startDate: new Date(),
                endDate: null, // Clear end date on reactivation/update
            },
            create: {
                userId: platformUserId,
                communityId: communityId,
                status: 'active',
                stripeSubscriptionId: stripeSubscriptionId,
                stripeCustomerId: stripeCustomerId,
                planType: planType,
                startDate: new Date(),
            },
        });
        console.log(`Subscription record updated/created for user ${platformUserId}, community ${communityId}`);

        // 3. Ensure User Exists in Circle (Create if not)
        let circleMemberExists = false;
        let circleCommunityMemberId: number | undefined = userRecord.circleCommunityMemberId ?? undefined;

        // If we already have the Circle ID stored, assume they exist in Circle
        if (circleCommunityMemberId) {
            console.log(`Using stored Circle Community Member ID: ${circleCommunityMemberId}`);
            circleMemberExists = true;
        }
        // Otherwise, search by email
        else {
            try {
                console.log(`Searching for Circle member by email: ${userEmail}`);
                const searchResult = await callCircleAdminApi<{ records: { id: number }[] }>(
                    'community_members/search',
                    { params: { email: userEmail } } // Pass email as param
                );
                if (searchResult.records && searchResult.records.length > 0) {
                    circleMemberExists = true;
                    circleCommunityMemberId = searchResult.records[0].id;
                    console.log(`Found existing Circle member ${userEmail} with ID: ${circleCommunityMemberId}`);
                    // Store Circle ID in our DB for future use
                    await prisma.user.update({ where: { id: platformUserId }, data: { circleCommunityMemberId } });
                } else {
                     console.log(`Circle member ${userEmail} not found via search.`);
                }
            } catch (searchError: unknown) {
                let isNotFoundError = false;
                if (hasStatusCode(searchError) && searchError.status === 404) {
                    isNotFoundError = true;
                }
                // Check details message as well, as Circle might not use 404 consistently
                if (!isNotFoundError && typeof searchError === 'object' && searchError !== null && 'details' in searchError) {
                    const details = (searchError as { details: unknown }).details;
                    if (isPotentialApiErrorData(details) && details.message?.includes('not found')) {
                         isNotFoundError = true;
                    }
                }

                if (isNotFoundError) {
                    console.log(`Circle member ${userEmail} not found (404/message), will attempt creation.`);
                    circleMemberExists = false;
                } else {
                    console.error('Unexpected error searching for Circle member:', searchError);
                    throw searchError;
                }
            }
        }

        // Create Circle member if they don't exist
        if (!circleMemberExists) {
            // const tempPassword = generateTemporaryPassword(); // Removed password generation
            console.log(`Attempting to create Circle member for ${userEmail}`);
            try {
                const createResult = await callCircleAdminApi<{ community_member: { id: number } }>('community_members', {
                    method: 'POST',
                    body: {
                        email: userEmail,
                        // password: tempPassword, // Removed password
                        // Let Circle handle password setup via its flow if needed
                        skip_invitation: true,
                        name: userName || undefined, // Pass name if available
                    },
                });
                circleCommunityMemberId = createResult.community_member.id;
                console.log(`Successfully created Circle member ${userEmail} with ID: ${circleCommunityMemberId}`);
                // Store Circle ID in our DB
                await prisma.user.update({ where: { id: platformUserId }, data: { circleCommunityMemberId } });
            } catch (createError) {
                console.error(`Failed to create Circle member ${userEmail}:`, createError);
                // Mark subscription as failed? Rollback?
                await prisma.subscription.update({
                    where: { id: subscription.id },
                    data: { status: 'provisioning_failed' }
                });
                throw new Error(`Failed to create Circle member: ${(createError as Error).message}`);
            }
        }

        // Ensure we have a Circle Community Member ID at this point
        if (!circleCommunityMemberId) {
            throw new Error('Could not determine Circle Community Member ID after search/create.');
        }

        // 4. Add User to Specific Space
        try {
            console.log(`Adding Circle member ${circleCommunityMemberId} (${userEmail}) to space ${spaceId}`);
            await callCircleAdminApi('space_members', {
                method: 'POST',
                body: {
                    // Use community_member_id if available, otherwise fallback to email (less reliable)
                    community_member_id: circleCommunityMemberId,
                    space_id: spaceId,
                    // email: userEmail, // Fallback if ID method fails?
                },
            });
            console.log(`Successfully added member ${circleCommunityMemberId} to Circle space ${spaceId}`);
        } catch (addError: unknown) {
             let alreadyMember = false;
             let errorMessage = 'Unknown error adding member to space';

             if (typeof addError === 'object' && addError !== null) {
                // Check common error message patterns
                const msg = (addError as { message?: string }).message?.toLowerCase() || '';
                const detailsMsg = ( (addError as { details?: unknown }).details as { message?: string })?.message?.toLowerCase() || '';
                if (msg.includes('already been taken') || msg.includes('already a member') ||
                    detailsMsg.includes('already been taken') || detailsMsg.includes('already a member')) {
                    alreadyMember = true;
                }
                // Capture a more specific message if possible
                 if ((addError as Error).message) errorMessage = (addError as Error).message;
             }

             if (alreadyMember) {
                 console.warn(`User ${circleCommunityMemberId} already in space ${spaceId}. Continuing.`);
             } else {
                console.error(`Failed to add member ${circleCommunityMemberId} to Circle space ${spaceId}:`, addError);
                await prisma.subscription.update({
                    where: { id: subscription.id },
                    data: { status: 'provisioning_failed' }
                });
                // Throw the captured or a generic message
                throw new Error(`Failed to add member to Circle space: ${errorMessage}`);
             }
        }

        console.log(`Provisioning completed successfully for ${userEmail} to space ${spaceId}.`);
        return { success: true };

    } catch (error) {
        console.error(`Provisioning failed overall for ${userEmail}, space ${spaceId}:`, error);
        // Attempt to mark subscription as failed if possible
        if (userRecord) { // Check if user upsert succeeded before trying to update subscription
            try {
                 await prisma.subscription.updateMany({
                    where: { userId: platformUserId, communityId: communityId, status: 'active' }, // only update if currently active
                    data: { status: 'provisioning_failed' }
                 });
            } catch (updateError) {
                console.error("Failed to mark subscription as provisioning_failed after main error:", updateError);
            }
        }
        return { success: false, error: (error as Error).message || 'Unknown provisioning error' };
    }
} 