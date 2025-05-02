import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function LandingPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
      <h1 className="text-4xl md:text-5xl font-bold mb-4">
        Welcome to Communities.irish Demo
      </h1>
      <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-8">
        Discover, join, and engage with exclusive online communities hosted on Circle.so.
        Subscribe easily and securely via Stripe to unlock access.
      </p>
      <div className="flex flex-col sm:flex-row gap-4">
        <Link href="/communities">
          <Button size="lg">Explore Communities</Button>
        </Link>
        <Link href="/sign-up">
          <Button size="lg" variant="outline">
            Sign Up Now
          </Button>
        </Link>
      </div>
      <p className="text-sm text-muted-foreground mt-12">
        This platform demonstrates integration between Next.js, Clerk, Stripe, Prisma, and Circle.so.
      </p>
    </div>
  );
} 