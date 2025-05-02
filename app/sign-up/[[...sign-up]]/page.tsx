'use client';

import { SignUp } from "@clerk/nextjs";
import { Suspense } from 'react';

function SignUpContent() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <SignUp 
        appearance={{
          elements: {
            formButtonPrimary: 'bg-primary hover:bg-primary/90',
            footerActionLink: 'text-primary hover:text-primary/90',
          }
        }}
        path="/sign-up"
        routing="path"
        signInUrl="/sign-in"
        redirectUrl="/"
      />
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Loading registration...</h2>
        </div>
      </div>
    }>
      <SignUpContent />
    </Suspense>
  );
} 