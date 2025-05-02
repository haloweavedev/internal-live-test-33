import { auth } from '@clerk/nextjs/server';

export default async function SpacesPage() {
  const { userId } = await auth();

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Explore Communities</h1>
      
      {userId ? (
        <div className="bg-white shadow-md rounded-lg p-6">
          <p className="text-gray-600 mb-4">
            Welcome to our community spaces! Here you&apos;ll discover specialized discussion areas 
            where members connect on topics that matter.
          </p>
          <div className="border border-gray-200 rounded-lg p-4 mb-4">
            <p className="text-gray-500 text-sm">
              Loading available communities... [not real]
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white shadow-md rounded-lg p-6">
          <p className="text-gray-600">
            Please sign in to view available community spaces.
          </p>
        </div>
      )}
    </div>
  );
} 