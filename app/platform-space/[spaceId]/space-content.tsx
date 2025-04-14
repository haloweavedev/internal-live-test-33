'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Button } from '@/components/ui/button'; // Keep import for future use

// --- Simplified Types (Should match the Server Component) ---
interface CirclePost {
    id: number;
    name: string; // Post title
    body: string; // HTML body - Requires careful rendering (see note below)
    body_plain_text?: string;
    slug: string;
    user_id: number;
    space_id: number;
    created_at: string;
    // Add other relevant fields: comment_count, like_count, user_name, user_avatar_url, etc.
}

interface SpaceContentProps {
    initialPosts: CirclePost[];
    spaceId: number;
    accessToken: string; // Pass token for potential client-side actions (like posting, commenting)
}

export default function SpaceContent({ 
    initialPosts, 
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    spaceId, // Keep prop for future use
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    accessToken // Keep prop for future use
}: SpaceContentProps) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [posts, setPosts] = useState<CirclePost[]>(initialPosts); // Keep setPosts for future
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [isLoading, setIsLoading] = useState(false); 
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [error, setError] = useState<string | null>(null); 

    // TODO: Add functions here later for creating posts/comments if needed.
    // These would call '/api/circle/member/...' wrapper endpoints on your Next.js backend
    // to securely use the accessToken.

    // WARNING: Rendering post.body directly is unsafe due to potential XSS.
    // Use a sanitization library (like DOMPurify) or render the plain text version.
    // For this simple demo, we show plain text.

    return (
        <div>
            <h2 className="text-2xl font-semibold mb-4 border-b pb-2">Recent Posts</h2>
            {isLoading && <p>Loading more posts...</p>} {/* Placeholder for pagination/loading */} 
            {error && <p className="text-red-500">Error: {error}</p>}
            {posts.length === 0 && !isLoading && (
                <p className="text-gray-500 italic">No posts found in this space yet.</p>
            )}
            <div className="space-y-4 mt-4">
                {posts.map(post => (
                    <Card key={post.id}>
                        <CardHeader>
                            {/* TODO: Link to full post view later */}
                            <CardTitle className="hover:text-blue-600 cursor-pointer">{post.name}</CardTitle>
                            <CardDescription>
                                Posted on: {new Date(post.created_at).toLocaleDateString()} 
                                {/* TODO: Add author name/avatar later */}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {/* Render SANITIZED HTML or plain text */}
                            <p className="text-sm text-muted-foreground line-clamp-3">
                                {post.body_plain_text || '(No content preview available)'}
                            </p>
                            {/* TODO: Add View Post button later -> /platform-space/[spaceId]/post/[postId] ? */}
                            {/* <Button variant="link" className="p-0 h-auto mt-2">View Post</Button> */} 
                        </CardContent>
                    </Card>
                ))}
            </div>
            {/* TODO: Add "Create Post" button/form later */}
            {/* <Button className="mt-6">Create New Post</Button> */} 
        </div>
    );
} 