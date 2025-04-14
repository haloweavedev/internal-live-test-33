import Link from 'next/link';

export default function CancelPage() {
  return (
    <div className="container mx-auto p-4 text-center">
      <h1 className="text-2xl font-bold text-orange-600 mb-4">Subscription Canceled</h1>
      <p>Your subscription process was canceled.</p>
      <p>You have not been charged.</p>
      <Link href="/checkout" className="text-blue-500 hover:underline mt-4 block">
        View Subscription Plans
      </Link>
      <Link href="/" className="text-blue-500 hover:underline mt-2 block">
        Go to Homepage
      </Link>
    </div>
  );
} 