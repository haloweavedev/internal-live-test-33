import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { callCircleHeadlessAuthApi } from '@/lib/circle-auth-api';
import { callCircleMemberApi } from '@/lib/circle-member-api';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import SpaceContent from './space-content'; // Path might need adjustment
import { Suspense } from 'react'; // Import Suspense

// --- Simplified Types (Expand as needed based on Circle API response) ---
interface CircleSpaceDetails {
    id: number;
    name: string;
    slug: string;
    community_id: number;
    // Add other relevant fields: description, member_count, etc.
}

interface CirclePost {
    id: number;
    name: string; // Post title
    body: string; // HTML body
    body_plain_text?: string;
    slug: string;
    user_id: number;
    space_id: number;
    created_at: string;
    // Add other relevant fields: comment_count, like_count, user_name, user_avatar_url, etc.
}

// Define the expected shape of the auth token response
interface CircleAuthTokenResponse {
    access_token: string;
    refresh_token?: string; // Optional, handle if provided
    expires_in?: number;
}

// Define the expected shape of the posts list response
interface CirclePostListResponse {
    records: CirclePost[];
    // Add pagination fields if needed: total_count, per_page, page
}

/**
 * Checks if the object is an error with status code.
 */
function hasStatusCode(error: unknown): error is { status?: number } {
    return typeof error === 'object' && error !== null && 'status' in error;
}

// --- Token Management (DEMO ONLY - NOT FOR PRODUCTION) ---
// This function is a placeholder for complex, secure token management.
// It calls the auth API every time, doesn't handle refresh tokens, and has no caching.
async function getMemberAccessToken(email: string): Promise<string | null> {
    console.warn("DEMO ONLY: Using direct Headless Auth API call for token. Implement proper token management for production.");
    try {
        // This directly calls the Auth API every time
        const tokenData = await callCircleHeadlessAuthApi<CircleAuthTokenResponse>('auth_token', {
            method: 'POST',
            body: { email: email }
        });
        // Check if access_token exists in the response
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

// --- Main Server Component --- 
export default async function PlatformSpacePage({ params }: { params: { spaceId: string } }) {
    const authObject = await auth(); // Await auth
    const userId = authObject.userId;
    const user = await currentUser();

    if (!userId || !user?.primaryEmailAddress?.emailAddress) {
        console.log('User not authenticated, redirecting to sign-in.');
        redirect('/sign-in');
    }

    // Use Number.parseInt for clarity and safety
    const spaceIdNum = Number.parseInt(params.spaceId, 10);
    // Use Number.isNaN for type safety
    if (Number.isNaN(spaceIdNum)) {
        return (
            <div className="container mx-auto p-4">
                <p className="text-red-500">Invalid Space ID provided in the URL.</p>
                 <Link href="/"><Button variant="outline" className="mt-4">&larr; Back to Communities</Button></Link>
            </div>
        );
    }

    console.log(`Fetching access token for user: ${user.primaryEmailAddress.emailAddress}`);
    const accessToken = await getMemberAccessToken(user.primaryEmailAddress.emailAddress);

    if (!accessToken) {
        return (
            <div className="container mx-auto p-4">
                 <Link href="/"><Button variant="outline" className="mb-4">&larr; Back to Communities</Button></Link>
                 <p className="text-red-500">Error: Could not authenticate your session with the community platform. Access denied. Please try again later or contact support.</p>
            </div>
       );
    }
    console.log('Successfully obtained member access token.');

    // --- Fetch Space Data --- 
    // Use Suspense for better loading states if fetching takes time
    // For simplicity here, we await directly

    let spaceDetails: CircleSpaceDetails | null = null;
    let initialPosts: CirclePost[] = [];
    let fetchError: string | null = null;

    try {
        console.log(`Fetching space details for spaceId: ${spaceIdNum}`);
        // Fetch space details
        spaceDetails = await callCircleMemberApi<CircleSpaceDetails>(`spaces/${spaceIdNum}`, { accessToken });
        console.log(`Successfully fetched space details: ${spaceDetails?.name}`);

        console.log(`Fetching posts for spaceId: ${spaceIdNum}`);
        // Fetch posts (limit for demo)
        const postData = await callCircleMemberApi<CirclePostListResponse>(`spaces/${spaceIdNum}/posts`, { accessToken, params: { per_page: 10 } });
        initialPosts = postData?.records || [];
        console.log(`Successfully fetched ${initialPosts.length} posts.`);

    } catch (error: unknown) {
        console.error(`Error fetching Circle space data for space ${spaceIdNum}:`, error);
        fetchError = (error instanceof Error) ? error.message : "Failed to load space content.";
        // Specific check for 403 Forbidden using type guard
        if (hasStatusCode(error) && error.status === 403) {
            fetchError = "Access Denied: You may not have access to this specific community space. Please check your subscription or contact support.";
        }
    }

    return (
        <div className="container mx-auto p-4">
            <Link href="/"><Button variant="outline" className="mb-4">&larr; Back to Communities</Button></Link>

            {/* Display Loading / Error / Content */} 
            {fetchError && (
                <div className="border-l-4 border-red-500 bg-red-50 p-4 mb-6">
                     <p className="font-semibold text-red-700">Error Loading Community Space</p>
                     <p className="text-red-600">{fetchError}</p>
                </div>
            )}

            {spaceDetails && !fetchError && (
                <h1 className="text-3xl font-bold mb-6">Welcome to {spaceDetails.name}</h1>
            )}
            {!spaceDetails && !fetchError && (
                <>
                     <h1 className="text-3xl font-bold mb-6">Loading Community Space...</h1>
                     {/* Correct JSX Comment Syntax */}
                     {/* Add a loading spinner/skeleton here */}
                </>
            )}

            {/* Pass data to client component for rendering posts */}
            {/* Only render SpaceContent if there wasn't a fatal fetch error */}
            {!fetchError && (
                <Suspense fallback={<p>Loading posts...</p>}> 
                    <SpaceContent initialPosts={initialPosts} spaceId={spaceIdNum} accessToken={accessToken} />
                </Suspense>
            )}
        </div>
    );
} 