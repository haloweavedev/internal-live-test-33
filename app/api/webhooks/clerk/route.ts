import { Webhook } from 'svix';
import { headers } from 'next/headers';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { callCircleAdminApi } from '@/lib/circle-admin-api';

type WebhookEvent = {
  type: string;
  data: {
    id: string;
    email_addresses: Array<{
      id: string;
      email_address: string;
    }>;
    first_name?: string;
    last_name?: string;
    username?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

type CircleApiResponse = {
  id: number;
  [key: string]: unknown;
};

// Webhook handler for Clerk user.created events
export async function POST(req: NextRequest) {
  // Get the signature header
  const headersList = await headers();
  const svix_id = headersList.get('svix-id');
  const svix_timestamp = headersList.get('svix-timestamp');
  const svix_signature = headersList.get('svix-signature');

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    console.error('Error: Missing Svix headers');
    return new NextResponse('Missing Svix headers', { status: 400 });
  }

  // Get the webhook signing secret
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    console.error('Error: CLERK_WEBHOOK_SECRET is not set');
    return new NextResponse('Missing webhook secret', { status: 500 });
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Create a new Svix instance with the secret
  const wh = new Webhook(secret);

  let evt: WebhookEvent;

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error('Error verifying webhook:', err);
    return new NextResponse('Error verifying webhook', { status: 400 });
  }

  // Only process user.created events
  const eventType = evt.type;
  if (eventType !== 'user.created') {
    console.log(`Skipping non-user.created event: ${eventType}`);
    return new NextResponse('Skipping non-user.created event', { status: 200 });
  }

  console.log('Processing user.created event');

  // Extract user data from the webhook payload
  const { id: userId, email_addresses, first_name, last_name, username } = evt.data;

  // Find the primary email
  const primaryEmail = email_addresses && email_addresses.length > 0
    ? email_addresses[0].email_address
    : null;

  if (!primaryEmail) {
    console.error('Error: User has no email address');
    return new NextResponse('User has no email address', { status: 500 });
  }

  // Construct a user name with fallbacks
  let constructedName = '';
  if (first_name && last_name) {
    constructedName = `${first_name} ${last_name}`.trim();
  } else if (first_name) {
    constructedName = first_name;
  } else if (last_name) {
    constructedName = last_name;
  } else if (username) {
    constructedName = username;
  } else {
    // Fallback to email prefix
    constructedName = primaryEmail.split('@')[0];
  }

  try {
    // Upsert user into the database
    console.log(`Upserting user ${userId} (${primaryEmail}) into database`);
    await prisma.user.upsert({
      where: { id: userId },
      create: {
        id: userId,
        email: primaryEmail,
        name: constructedName,
      },
      update: {
        email: primaryEmail,
        name: constructedName,
      },
    });

    console.log(`Successfully upserted user ${userId} in database`);

    // Invite user to Circle
    try {
      console.log(`Inviting user ${primaryEmail} to Circle community`);
      const circleResponse = await callCircleAdminApi<CircleApiResponse>('community_members', {
        method: 'POST',
        body: {
          email: primaryEmail,
          name: constructedName,
          skip_invitation: false, // Explicitly set to false to send invitation email
        },
      });

      // If the Circle API call was successful, store the Circle member ID
      if (circleResponse?.id) {
        console.log(`Successfully invited user to Circle with member ID: ${circleResponse.id}`);
        
        // Update user record with Circle community member ID
        await prisma.user.update({
          where: { id: userId },
          data: { circleCommunityMemberId: circleResponse.id },
        });
        
        console.log(`Updated user ${userId} with Circle member ID: ${circleResponse.id}`);
      }
    } catch (circleError) {
      // Log the Circle API error but don't fail the webhook response
      console.error('Error inviting user to Circle:', circleError);
      console.warn(`Circle invitation failed for user ${userId} (${primaryEmail}). Manual follow-up required.`);
      
      // We continue processing and return success to Clerk even though the Circle invite failed
      // The user exists in our system and Clerk, but will need manual attention for Circle
    }

    // Return a 200 OK response to Clerk
    return new NextResponse(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (dbError) {
    // If the database operation fails, log and return an error
    console.error('Database error in Clerk webhook handler:', dbError);
    return new NextResponse('Database error', { status: 500 });
  }
} 