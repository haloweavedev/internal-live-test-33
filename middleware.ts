import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Define public routes
const isPublicRoute = createRouteMatcher([
  "/",                  // Make the landing page public
  "/landing-test",      // Make the landing-test page public
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/cancel",
  "/api/webhooks/clerk",
  "/api/webhooks/stripe"
]);

export default clerkMiddleware(
  async (auth, req) => {
    // If the route is not public, protect it
    if (!isPublicRoute(req)) {
      await auth.protect();
    }
  }
);

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};