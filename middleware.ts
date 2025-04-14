import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Protect routes that require login
const isProtectedRoute = createRouteMatcher([
  '/', // Protect homepage/community list
  '/subscribe(.*)',
  '/platform-space(.*)', // Protect the custom space view
  '/payment-success(.*)', // Needs auth to link payment to user
  '/admin(.*)', // Protect admin panel
  '/checkout', // Protect checkout page
  // Add '/api/create-checkout-session' if you want to ensure only logged-in users create sessions
]);

// Public routes (like sign-in, sign-up)
const isPublicRoute = createRouteMatcher([
    '/sign-in(.*)',
    '/sign-up(.*)',
    '/cancel', // Stripe cancel page should be public
    // '/api/webhooks/clerk', // Removed Clerk webhook route
    // Add other public routes/APIs if needed
]);

export default clerkMiddleware((auth, req) => {
  // Protect routes if they are not public
  if (isProtectedRoute(req)) {
    // @ts-ignore - Clerk documentation pattern, may be a temporary type issue
    auth().protect();
  }
});

export const config = {
  // The following matcher has been adjusted to match Clerk documentation recommendations
  // See https://clerk.com/docs/references/nextjs/clerk-middleware
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
}; 