import prisma from './prisma';
import { callCircleAdminApi } from './circle-admin-api';
// import crypto from 'node:crypto'; // Removed unused import
// import type { Prisma } from '@prisma/client'; // Remove problematic Prisma import
import type { ApiResponse } from '@/types'; // Import the new type

// Define a local interface for the expected user record shape
interface UserWithCircleId {
    id: string;
    email: string;
    name: string | null;
    circleCommunityMemberId: number | null;
    createdAt: Date;
    updatedAt: Date;
}

// Define interfaces for API responses if not already done globally
interface CircleMember {
  id: number;
  user_id: number;
  community_id: number;
  // Add other relevant fields
}

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
): Promise<ApiResponse<void>> {
    console.log(`Provisioning access for ${userEmail} (ID: ${platformUserId}) to space ${spaceId}`);
    // Use the locally defined interface
    let userRecord: UserWithCircleId | null = null;

    try {
        // 1. Upsert User in Platform DB (ensure user exists locally)
        // This step is crucial since we removed the Clerk webhook
        try {
            userRecord = await prisma.user.upsert({
                where: { id: platformUserId },
                update: { 
                    name: userName, 
                    email: userEmail, 
                    stripeCustomerId: stripeCustomerId // Update stripeCustomerId here
                },
                create: {
                    id: platformUserId,
                    email: userEmail,
                    name: userName,
                    stripeCustomerId: stripeCustomerId // Set stripeCustomerId here
                },
                select: { id: true, email: true, name: true, circleCommunityMemberId: true, createdAt: true, updatedAt: true }
            }) as UserWithCircleId; // Add type assertion for safety
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
                planType: planType,
                startDate: new Date(),
                endDate: null, // Clear end date on reactivation/update
            },
            create: {
                userId: platformUserId,
                communityId: communityId,
                status: 'active',
                stripeSubscriptionId: stripeSubscriptionId,
                planType: planType,
                startDate: new Date(),
            },
        });
        console.log(`Subscription record updated/created for user ${platformUserId}, community ${communityId}`);

        // 3. Ensure User Exists in Circle (Create if not)
        let circleMemberExists = false;
        let circleCommunityMemberId: number | undefined = userRecord?.circleCommunityMemberId ?? undefined;

        // If we already have the Circle ID stored, assume they exist in Circle
        if (circleCommunityMemberId) {
            console.log(`Using stored Circle Community Member ID: ${circleCommunityMemberId}`);
            circleMemberExists = true;
        }
        // Otherwise, search by email
        else {
            try {
                console.log(`Searching for Circle member by email: ${userEmail}`);
                const searchResult = await callCircleAdminApi<{ community_members: CircleMember[] }>(`community_members/search`, {
                    method: 'GET',
                    params: { email: userEmail },
                });

                if (searchResult.community_members && searchResult.community_members.length > 0) {
                    circleMemberExists = true;
                    circleCommunityMemberId = searchResult.community_members[0].id;
                    console.log(`Found existing Circle member ID: ${circleCommunityMemberId} for email: ${userEmail}`);
                    // Store Circle ID in our DB for future use
                    await prisma.user.update({ where: { id: platformUserId }, data: { circleCommunityMemberId } });
                } else {
                     console.log(`Circle member ${userEmail} not found..., will attempt creation.`);
                     // If not found, create them
                     console.log(`Attempting to create Circle member for ${userEmail}`);
                     const createResult = await callCircleAdminApi<CircleMember>('community_members', {
                         method: 'POST',
                         body: {
                             community_id: 1, // Replace with your actual Community ID from Circle if needed, often it's just 1
                             email: userEmail,
                             name: userName || userEmail.split('@')[0], // Use provided name or derive from email
                             skip_invitation: true, // Crucial: Do not send invite email
                         },
                     });
                     circleCommunityMemberId = createResult.id;
                     console.log(`Successfully created Circle member ${userEmail} with ID: ${circleCommunityMemberId}`);
                     // Store Circle ID in our DB
                     await prisma.user.update({ where: { id: platformUserId }, data: { circleCommunityMemberId } });
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
                await prisma.subscription.update({
                    where: { id: subscription.id },
                    data: { status: 'provisioning_failed' }
                });
                throw createError;
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
                    community_member_id: circleCommunityMemberId,
                    space_id: spaceId,
                    email: userEmail,
                },
            });
            console.log(`Successfully added member ${circleCommunityMemberId} to Circle space ${spaceId}`);
        } catch (addError: unknown) {
             let alreadyMember = false;
             // Variable is used for log messages, no need to store separately
             // let errorMessage = 'Unknown error adding member to space';

             if (typeof addError === 'object' && addError !== null) {
                // Check common error message patterns
                const msg = (addError as { message?: string }).message?.toLowerCase() || '';
                const detailsMsg = ( (addError as { details?: unknown }).details as { message?: string })?.message?.toLowerCase() || '';
                if (msg.includes('already been taken') || msg.includes('already a member') ||
                    detailsMsg.includes('already been taken') || detailsMsg.includes('already a member')) {
                    alreadyMember = true;
                }
                // Capture a more specific message if possible
                 // if ((addError as Error).message) errorMessage = (addError as Error).message;
             }

             if (alreadyMember) {
                 console.warn(`User ${circleCommunityMemberId} already in space ${spaceId}. Continuing.`);
             } else {
                console.error(`Failed to add member ${circleCommunityMemberId} to Circle space ${spaceId}:`, addError);
                await prisma.subscription.update({
                    where: { id: subscription.id },
                    data: { status: 'provisioning_failed' }
                });
                throw addError;
             }
        }

        console.log(`Provisioning completed successfully for ${userEmail} to space ${spaceId}.`);
        return { success: true, data: undefined };

    } catch (error) {
        // Main error handling
        console.error('Error provisioning Circle access:', error);
        
        return { 
            success: false, 
            error: 'Error provisioning Circle access'
        };
    }
} 