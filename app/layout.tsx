import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import {
  ClerkProvider,
  SignedIn,
  SignedOut,
  UserButton
} from '@clerk/nextjs';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Communities.irish Next Demo",
  description: "Demo platform for communities.shift.irish",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode; }>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body className={inter.className}>
          <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-16 max-w-screen-2xl items-center px-4">
              <Link href="/" className="mr-6 flex items-center space-x-2">
                <span className="text-lg font-semibold inline-block">Communities.irish</span>
              </Link>
              <nav className="flex flex-1 items-center justify-end space-x-4">
                <SignedIn>
                  <Link href="/spaces" className="mr-2">
                    <Button variant="ghost">Explore Spaces</Button>
                  </Link>
                  <Link href="/account" className="mr-2">
                    <Button variant="ghost">My Account</Button>
                  </Link>
                  <Link href="/admin">
                    <Button variant="ghost">Admin</Button>
                  </Link>
                  <UserButton afterSignOutUrl="/" />
                </SignedIn>
                <SignedOut>
                  <Link href="/spaces" className="mr-2">
                    <Button variant="ghost">Explore Spaces</Button>
                  </Link>
                  <Link href="/sign-in">
                    <Button variant="ghost">Sign In</Button>
                  </Link>
                  <Link href="/sign-up">
                    <Button>Sign Up</Button>
                  </Link>
                </SignedOut>
              </nav>
            </div>
          </header>
          <main className="flex-1">{children}</main>
          <Toaster />
        </body>
      </html>
    </ClerkProvider>
  );
}
