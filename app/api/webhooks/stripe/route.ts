import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import Stripe from 'stripe';
import prisma from '@/lib/prisma';
import { callCircleAdminApi } from '@/lib/circle-admin-api';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, { typescript: true }) : null;

// Helper function to handle subscription changes
async function handleSubscriptionChange(stripeSubscriptionId: string, newStatus: string, endDateMs: number | null = null) {
    console.log(`Handling subscription change for ${stripeSubscriptionId} to status ${newStatus} ${endDateMs ? `(ends: ${new Date(endDateMs).toISOString()})` : ''}`);
    try {
        // 1. Find local subscription and related user/community data
        const subscription = await prisma.subscription.findUnique({
            where: { stripeSubscriptionId: stripeSubscriptionId },
            include: {
                user: { select: { id: true, email: true } },
                community: { select: { circleSpaceId: true } }
            }
        });

        if (!subscription || !subscription.user || !subscription.community) {
            console.warn(`Webhook received for unknown or incomplete subscription ${stripeSubscriptionId}. Ignoring.`);
            // Acknowledge webhook but do nothing if we don't recognize the sub
            // Important to return success to Stripe to prevent retries for this specific case.
            return { success: true, message: "Subscription not found locally, ignoring." };
        }

        // 2. Update local DB status & endDate
        // Only update if the status is actually changing or endDate needs setting/clearing
        const dataToUpdate: Record<string, string | Date | null> = {};
        let needsUpdate = false;

        if (subscription.status !== newStatus) {
            dataToUpdate.status = newStatus;
            needsUpdate = true;
        }
        // Check if endDate needs updating (handles cancel_at_period_end toggling)
        const currentEndDate = subscription.endDate ? subscription.endDate.getTime() : null;
        if (currentEndDate !== endDateMs) {
             dataToUpdate.endDate = endDateMs ? new Date(endDateMs) : null;
             needsUpdate = true;
        }

        if (needsUpdate) {
            await prisma.subscription.update({
                where: { id: subscription.id },
                data: dataToUpdate
            });
            console.log(`Updated local subscription ${subscription.id} status to ${newStatus}, endDate to ${dataToUpdate.endDate}`);
        } else {
             console.log(`Local subscription ${subscription.id} already reflects status ${newStatus} and endDate ${endDateMs}. No DB update needed.`);
        }

        // 3. Revoke Circle Access if subscription is definitively ended
        const isEnded = ['canceled', 'unpaid'].includes(newStatus); // Define which statuses mean access removal
        if (isEnded) {
            console.log(`Subscription ended. Attempting to revoke Circle access for user ${subscription.userId} (${subscription.user.email}) from space ${subscription.community.circleSpaceId}`);
            try {
                // Use DELETE with query parameters for space_members endpoint
                await callCircleAdminApi('space_members', {
                    method: 'DELETE',
                    params: {
                        email: subscription.user.email,
                        space_id: subscription.community.circleSpaceId
                    }
                });
                console.log(`Successfully revoked Circle access for ${subscription.user.email} from space ${subscription.community.circleSpaceId}`);
            } catch (circleError: unknown) {
                // Log error but don't fail the webhook response
                console.error(`Failed to revoke Circle access for ${subscription.user.email} from space ${subscription.community.circleSpaceId}:`, circleError);
                // Update local status to indicate failure for manual review
                await prisma.subscription.update({
                    where: { id: subscription.id },
                    data: { status: 'access_revocation_failed' }
                });
                // Still return success to Stripe, but log the internal failure
                return { success: true, message: "DB updated, Circle revocation failed." };
            }
        }
         return { success: true, message: "Subscription change processed." };
    } catch (error) {
        console.error(`Error processing subscription change for ${stripeSubscriptionId}:`, error);
        // Re-throw to signal failure to the main handler
        throw error;
    }
}

// Use a type assertion with a more specific type instead of any
interface InvoiceData {
    id: string;
    subscription?: string | { id: string };
}

export async function POST(req: NextRequest) {
    if (!stripe || !webhookSecret) {
        console.error('Stripe or Webhook Secret configuration error.');
        return NextResponse.json({ error: 'Webhook configuration error.' }, { status: 500 });
    }

    const buf = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
        console.error('Missing stripe-signature header');
        return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(buf, signature, webhookSecret);
        console.log(`Stripe webhook event received: ${event.type}`);
    } catch (err) {
        const message = `Webhook signature verification failed: ${(err as Error).message}`;
        console.error(message);
        return NextResponse.json({ error: message }, { status: 400 });
    }

    // Handle the event
    try {
        switch (event.type) {
            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription;
                await handleSubscriptionChange(subscription.id, 'canceled');
                break;
            }
            case 'customer.subscription.updated': {
                const subscription = event.data.object as Stripe.Subscription;
                const newStatus = subscription.status; // active, past_due, unpaid, canceled, incomplete, incomplete_expired
                
                // Handle cancel_at (safely handle undefined with optional chaining and nullish coalescing)
                const cancelAtSeconds = subscription.cancel_at_period_end ? subscription.cancel_at ?? null : null;
                const endDate = cancelAtSeconds ? cancelAtSeconds * 1000 : null;

                // Handle various statuses that might require action
                if (['active', 'past_due', 'unpaid', 'canceled'].includes(newStatus)) {
                     await handleSubscriptionChange(subscription.id, newStatus, endDate);
                } else {
                     console.log(`Ignoring subscription update with status: ${newStatus}`);
                }
                break;
            }
            case 'invoice.payment_failed': {
                // Use a type assertion with a more specific type
                const invoiceData = event.data.object as InvoiceData;
                
                // Safely extract subscription ID if it exists
                let subscriptionId: string | undefined;
                
                if (invoiceData.subscription) {
                    if (typeof invoiceData.subscription === 'string') {
                        subscriptionId = invoiceData.subscription;
                    } else if (invoiceData.subscription.id) {
                        subscriptionId = invoiceData.subscription.id;
                    }
                }
                
                if (subscriptionId) {
                    await handleSubscriptionChange(subscriptionId, 'past_due');
                } else {
                    console.warn(`Invoice payment failed event without a subscription ID: ${invoiceData.id}`);
                }
                break;
            }
            default:
                console.log(`Unhandled Stripe event type: ${event.type}`);
        }
        return NextResponse.json({ received: true });
    } catch (error) {
         console.error(`Error processing webhook event ${event.id} (${event.type}):`, error);
         // Return 500 to signal Stripe to retry (if applicable for the error)
         return NextResponse.json({ error: 'Webhook processing error' }, { status: 500 });
    }
} 