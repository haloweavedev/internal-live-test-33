import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { callCircleHeadlessAuthApi } from '@/lib/circle-auth-api';
import { callCircleMemberApi } from '@/lib/circle-member-api';

// Define the shape of the auth token response
interface CircleAuthTokenResponse {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
}

// Define Circle space and post types
interface CircleSpaceDetails {
    id: number;
    name: string;
    slug: string;
    community_id: number;
}

interface CirclePost {
    id: number;
    name: string;
    body: string;
    slug: string;
    user_id: number;
    space_id: number;
    created_at: string;
}

// Define the shape of the posts list response
interface CirclePostListResponse {
    records: CirclePost[];
}

// Token management function
async function getMemberAccessToken(email: string): Promise<string | null> {
    try {
        const tokenData = await callCircleHeadlessAuthApi<CircleAuthTokenResponse>('auth_token', {
            method: 'POST',
            body: { email: email }
        });
        
        if (tokenData && typeof tokenData.access_token === 'string') {
            return tokenData.access_token;
        }
        
        console.error("Failed to get valid access_token from Circle Auth API response:", tokenData);
        return null;
    } catch (error) {
        console.error("Error calling Circle Headless Auth API:", error);
        return null;
    }
}

export async function GET(request: NextRequest) {
    // Get the authenticated user
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await currentUser();
    if (!user?.primaryEmailAddress?.emailAddress) {
        return NextResponse.json({ error: 'User email not found' }, { status: 400 });
    }

    const email = user.primaryEmailAddress.emailAddress;
    
    // Get space ID from query params
    const searchParams = request.nextUrl.searchParams;
    const spaceIdParam = searchParams.get('spaceId');
    
    if (!spaceIdParam) {
        return NextResponse.json({ error: 'spaceId parameter is required' }, { status: 400 });
    }
    
    const spaceId = Number.parseInt(spaceIdParam, 10);
    if (Number.isNaN(spaceId)) {
        return NextResponse.json({ error: 'Invalid spaceId parameter' }, { status: 400 });
    }

    try {
        // Get access token
        const accessToken = await getMemberAccessToken(email);
        if (!accessToken) {
            return NextResponse.json({ 
                error: 'Could not authenticate with the community platform' 
            }, { status: 500 });
        }

        // Fetch space details
        const spaceDetails = await callCircleMemberApi<CircleSpaceDetails>(`spaces/${spaceId}`, { accessToken });
        
        // Fetch posts
        const postData = await callCircleMemberApi<CirclePostListResponse>(`spaces/${spaceId}/posts`, { 
            accessToken, 
            params: { per_page: 10 } 
        });
        
        // Return all the data
        return NextResponse.json({
            accessToken,
            spaceDetails,
            posts: postData?.records || []
        });
    } catch (error) {
        console.error('Error fetching Circle space data:', error);
        
        // Check for specific error status codes
        if (error && typeof error === 'object' && 'status' in error) {
            const status = (error as { status: number }).status;
            
            if (status === 403) {
                return NextResponse.json({ 
                    error: 'Access Denied: You may not have access to this community space' 
                }, { status: 403 });
            }
        }
        
        return NextResponse.json({ 
            error: error instanceof Error ? error.message : 'Failed to load space data' 
        }, { status: 500 });
    }
} 