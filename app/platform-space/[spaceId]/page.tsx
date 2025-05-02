import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { callCircleAdminApi } from '@/lib/circle-admin-api';

// Define Circle Space response interface
interface CircleSpaceAdminData {
  id: number;
  name: string;
  slug: string;
  url?: string;
  community_id?: number;
  // Add other fields if needed for display
}

export default async function PlatformSpacePage({ params }: { params: { spaceId: string } }) {
  // Get authentication status
  const { userId } = await auth();
  
  // Redirect to sign-in if not authenticated
  if (!userId) {
    redirect('/sign-in');
  }

  // Get and validate spaceId from params
  const { spaceId } = params;
  const spaceIdNum = Number.parseInt(spaceId, 10);
  
  if (Number.isNaN(spaceIdNum)) {
    return (
      <div className="container mx-auto p-4">
        <Link href="/"><Button variant="outline" className="mb-4">&larr; Back to Communities</Button></Link>
        <div className="border-l-4 border-red-500 bg-red-50 p-4 mb-6">
          <p className="font-semibold text-red-700">Invalid Space ID</p>
          <p className="text-red-600">The provided space ID is not valid.</p>
        </div>
      </div>
    );
  }

  // Fetch space details from Circle Admin API
  let spaceData: CircleSpaceAdminData | null = null;
  let fetchError: string | null = null;

  try {
    spaceData = await callCircleAdminApi<CircleSpaceAdminData>(`spaces/${spaceIdNum}`);
  } catch (error: unknown) {
    console.error(`Failed to fetch space details for ID ${spaceIdNum}:`, error);
    const typedError = error as { message?: string; status?: number };
    fetchError = typedError.message || "Could not load space details.";
    if (typedError.status === 404) {
      fetchError = "The requested community space could not be found.";
    }
  }

  // Build Circle space URL
  const circleBaseUrl = process.env.CIRCLE_BASE_URL?.replace(/\/$/, '') || 'https://shift-irish-groups.circle.so';
  const circleSpaceUrl = spaceData?.url || `${circleBaseUrl}/c/${spaceData?.slug}`;

  return (
    <div className="container mx-auto p-4">
      <Link href="/"><Button variant="outline" className="mb-4">&larr; Back to Communities</Button></Link>

      {/* Display Error */}
      {fetchError && (
        <div className="border-l-4 border-red-500 bg-red-50 p-4 mb-6">
          <p className="font-semibold text-red-700">Error Loading Community Space</p>
          <p className="text-red-600">{fetchError}</p>
        </div>
      )}

      {/* Display Space Content with Link to Circle */}
      {spaceData && !fetchError && (
        <div className="space-y-6">
          <h1 className="text-3xl font-bold">You have access to: {spaceData.name}</h1>
          
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 my-4">
            <p className="text-blue-700 mb-2">You can now access all content and discussions for this community directly on our Circle platform.</p>
          </div>
          
          <Button asChild size="lg" className="mt-4">
            <a 
              href={circleSpaceUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center"
            >
              Go to {spaceData.name} Space
              <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </Button>
          
          <p className="text-sm text-gray-500 mt-2">
            You may need to log in to Circle using the credentials you set up after accepting the invitation if you aren&apos;t already logged in there.
          </p>
        </div>
      )}

      {/* Generic error when neither space data nor error exists */}
      {!spaceData && !fetchError && (
        <div className="border-l-4 border-yellow-500 bg-yellow-50 p-4 mb-6">
          <p className="font-semibold text-yellow-700">Unable to Load Space</p>
          <p className="text-yellow-600">We couldn&apos;t load the details for this community space. Please try again later.</p>
        </div>
      )}
    </div>
  );
} 