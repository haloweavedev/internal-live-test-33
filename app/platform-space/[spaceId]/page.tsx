import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card';
import { ExternalLink, ArrowLeft, CheckCircle, AlertTriangle } from 'lucide-react';
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

interface PlatformSpacePageProps {
  params: Promise<{ spaceId: string }>;
  searchParams?: Promise<Record<string, string | string[]>>;
}

export default async function PlatformSpacePage(props: PlatformSpacePageProps) {
  // Get authentication status
  const { userId } = await auth();
  
  // Redirect to sign-in if not authenticated
  if (!userId) {
    redirect('/sign-in');
  }

  // Get and validate spaceId from params
  const params = await props.params;
  const { spaceId } = params;
  const spaceIdNum = Number.parseInt(spaceId, 10);
  
  if (Number.isNaN(spaceIdNum)) {
    return (
      <div className="container max-w-4xl mx-auto py-12 px-4">
        <Link href="/spaces">
          <Button variant="outline" className="mb-8 flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Communities
          </Button>
        </Link>
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardHeader>
            <CardTitle className="text-red-700 dark:text-red-400 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Invalid Space ID
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-600 dark:text-red-400">The provided space ID is not valid. Please check the URL and try again.</p>
          </CardContent>
        </Card>
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
    <div className="container max-w-4xl mx-auto py-12 px-4">
      <Link href="/spaces">
        <Button variant="outline" className="mb-8 flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Communities
        </Button>
      </Link>

      {/* Display Error */}
      {fetchError && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardHeader>
            <CardTitle className="text-red-700 dark:text-red-400 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Error Loading Community Space
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-600 dark:text-red-400">{fetchError}</p>
          </CardContent>
        </Card>
      )}

      {/* Display Space Content with Link to Circle */}
      {spaceData && !fetchError && (
        <Card className="border shadow-sm overflow-hidden">
          <CardHeader className="bg-primary/5 border-b pb-4">
            <CardTitle className="text-2xl">You have access to: {spaceData.name}</CardTitle>
            <CardDescription>Your subscription is active</CardDescription>
          </CardHeader>
          
          <CardContent className="pt-6 pb-4">
            <div className="rounded-md bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 dark:bg-blue-950/20">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <CheckCircle className="h-5 w-5 text-blue-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-blue-700 dark:text-blue-400">
                    You can now access all content and discussions for this community directly on our Circle platform.
                  </p>
                </div>
              </div>
            </div>
            
            <p className="text-muted-foreground mb-6">
              Click the button below to go to the community space. You may need to log in to Circle if you aren&apos;t already logged in there.
            </p>
            
            <Button asChild size="lg" className="w-full sm:w-auto">
              <a 
                href={circleSpaceUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2"
              >
                Go to {spaceData.name} Space
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </CardContent>
          
          <CardFooter className="bg-muted/20 border-t text-xs text-muted-foreground pt-4">
            <p>
              All community content is hosted on Circle. If you experience any issues, please contact support.
            </p>
          </CardFooter>
        </Card>
      )}

      {/* Generic error when neither space data nor error exists */}
      {!spaceData && !fetchError && (
        <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20">
          <CardHeader>
            <CardTitle className="text-yellow-700 dark:text-yellow-400 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Unable to Load Space
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-yellow-600 dark:text-yellow-400">
              We couldn&apos;t load the details for this community space. Please try again later.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 