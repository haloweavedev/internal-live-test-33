'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import SpaceContent from './space-content';

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

// --- Main Content Component --- 
function PlatformSpaceContent() {
    const params = useParams();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [spaceDetails, setSpaceDetails] = useState<CircleSpaceDetails | null>(null);
    const [initialPosts, setInitialPosts] = useState<CirclePost[]>([]);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [accessToken, setAccessToken] = useState<string | null>(null);

    useEffect(() => {
        const spaceId = params.spaceId as string;
        
        // Validate spaceId
        const spaceIdNum = Number.parseInt(spaceId, 10);
        if (Number.isNaN(spaceIdNum)) {
            setFetchError('Invalid Space ID provided in the URL.');
            setIsLoading(false);
            return;
        }

        const fetchSpaceData = async () => {
            try {
                // Get access token and space data from the API
                const response = await fetch(`/api/circle-space-data?spaceId=${spaceIdNum}`);
                
                if (!response.ok) {
                    const errorData = await response.json();
                    if (response.status === 401) {
                        // Unauthorized, redirect to sign-in
                        router.push('/sign-in');
                        return;
                    }
                    throw new Error(errorData.error || 'Failed to load space data');
                }

                const data = await response.json();
                setAccessToken(data.accessToken);
                setSpaceDetails(data.spaceDetails);
                setInitialPosts(data.posts || []);
            } catch (error) {
                console.error('Error fetching space data:', error);
                setFetchError(error instanceof Error ? error.message : 'Failed to load space content');
            } finally {
                setIsLoading(false);
            }
        };

        fetchSpaceData();
    }, [params.spaceId, router]);

    return (
        <div className="container mx-auto p-4">
            <Link href="/"><Button variant="outline" className="mb-4">&larr; Back to Communities</Button></Link>

            {/* Display Loading / Error / Content */}
            {isLoading && (
                <h1 className="text-3xl font-bold mb-6">Loading Community Space...</h1>
            )}

            {fetchError && (
                <div className="border-l-4 border-red-500 bg-red-50 p-4 mb-6">
                    <p className="font-semibold text-red-700">Error Loading Community Space</p>
                    <p className="text-red-600">{fetchError}</p>
                </div>
            )}

            {spaceDetails && !fetchError && (
                <h1 className="text-3xl font-bold mb-6">Welcome to {spaceDetails.name}</h1>
            )}

            {/* Pass data to client component for rendering posts */}
            {!fetchError && !isLoading && accessToken && (
                <Suspense fallback={<p>Loading posts...</p>}>
                    <SpaceContent 
                        initialPosts={initialPosts} 
                        spaceId={Number(params.spaceId)} 
                        accessToken={accessToken} 
                    />
                </Suspense>
            )}
        </div>
    );
}

// --- Main Page Component wrapped with Suspense ---
export default function PlatformSpacePage() {
    return (
        <Suspense fallback={
            <div className="container mx-auto p-4">
                <Link href="/"><Button variant="outline" className="mb-4">&larr; Back to Communities</Button></Link>
                <h1 className="text-3xl font-bold mb-6">Loading Community Space...</h1>
            </div>
        }>
            <PlatformSpaceContent />
        </Suspense>
    );
} 