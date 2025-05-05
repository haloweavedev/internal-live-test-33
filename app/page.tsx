// app/page.tsx (Server Component)
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Users, Globe, Calendar, ArrowRight } from "lucide-react";

export default function LandingPage() {
    return (
        <div className="flex flex-col min-h-screen">
            {/* Hero Section */}
            <section className="py-20 md:py-28 px-4">
                <div className="container mx-auto text-center max-w-4xl">
                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
                        Connect with the Irish Diaspora
                    </h1>
                    <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
                        Discover exclusive online spaces for networking, culture, and professional 
                        development within the global Irish community.
                    </p>
                    <div className="flex flex-col sm:flex-row justify-center gap-4">
                        <Button size="lg" asChild>
                            <Link href="/spaces">
                                Explore Communities <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                        </Button>
                        <Button size="lg" variant="outline" asChild>
                            <Link href="/sign-up">
                                Sign Up Free
                            </Link>
                        </Button>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="py-16 bg-secondary/30">
                <div className="container mx-auto px-4">
                    <h2 className="text-3xl font-bold text-center mb-12">Why Join Our Platform?</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {/* Feature 1 */}
                        <div className="bg-card p-6 rounded-lg shadow-sm border flex flex-col items-center text-center">
                            <div className="bg-primary/10 p-3 rounded-full mb-4">
                                <Users className="h-8 w-8 text-primary" />
                            </div>
                            <h3 className="text-xl font-semibold mb-2">Curated Spaces</h3>
                            <p className="text-muted-foreground">
                                Access private groups focused on specific interests, industries, and regional connections.
                            </p>
                        </div>
                        
                        {/* Feature 2 */}
                        <div className="bg-card p-6 rounded-lg shadow-sm border flex flex-col items-center text-center">
                            <div className="bg-primary/10 p-3 rounded-full mb-4">
                                <Calendar className="h-8 w-8 text-primary" />
                            </div>
                            <h3 className="text-xl font-semibold mb-2">Exclusive Events</h3>
                            <p className="text-muted-foreground">
                                Participate in virtual and in-person networking events, workshops, and cultural celebrations.
                            </p>
                        </div>
                        
                        {/* Feature 3 */}
                        <div className="bg-card p-6 rounded-lg shadow-sm border flex flex-col items-center text-center">
                            <div className="bg-primary/10 p-3 rounded-full mb-4">
                                <Globe className="h-8 w-8 text-primary" />
                            </div>
                            <h3 className="text-xl font-semibold mb-2">Global Network</h3>
                            <p className="text-muted-foreground">
                                Connect with Irish professionals, entrepreneurs, and cultural enthusiasts from around the world.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20 text-center">
                <div className="container mx-auto px-4 max-w-3xl">
                    <h2 className="text-3xl font-bold mb-4">Ready to Join the Community?</h2>
                    <p className="text-lg text-muted-foreground mb-8">
                        Start exploring our communities and connect with like-minded individuals today.
                    </p>
                    <Button size="lg" asChild>
                        <Link href="/sign-up">
                            Get Started Now
                        </Link>
                    </Button>
                </div>
            </section>
            
            {/* Footer */}
            <footer className="py-8 bg-muted/30 border-t">
                <div className="container mx-auto px-4">
                    <div className="flex flex-col md:flex-row justify-between items-center">
                        <div className="mb-4 md:mb-0">
                            <p className="text-sm text-muted-foreground">© 2023 Communities.irish. All rights reserved.</p>
                        </div>
                        <div className="flex space-x-4">
                            <Link href="#" className="text-sm text-muted-foreground hover:text-foreground">
                                Privacy Policy
                            </Link>
                            <Link href="#" className="text-sm text-muted-foreground hover:text-foreground">
                                Terms of Service
                            </Link>
                            <Link href="#" className="text-sm text-muted-foreground hover:text-foreground">
                                Contact Us
                            </Link>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}