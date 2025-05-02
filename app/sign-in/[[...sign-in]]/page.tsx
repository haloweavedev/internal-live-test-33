'use client';

import { SignIn } from "@clerk/nextjs";
import { Suspense } from 'react';

function SignInContent() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <SignIn 
        appearance={{
          elements: {
            formButtonPrimary: 'bg-primary hover:bg-primary/90',
            footerActionLink: 'text-primary hover:text-primary/90',
          }
        }}
        path="/sign-in"
        routing="path"
        signUpUrl="/sign-up"
        redirectUrl="/"
      />
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Loading authentication...</h2>
        </div>
      </div>
    }>
      <SignInContent />
    </Suspense>
  );
} 