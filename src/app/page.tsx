import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

const MacaronLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 64 64" className={className} fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M52,22.04C52,14.29,43.71,8,34,8H30C20.29,8,12,14.29,12,22.04a2.5,2.5,0,0,0,0,.27C12,25.25,16.42,30,26,30h12C47.58,30,52,25.25,52,22.31A2.5,2.5,0,0,0,52,22.04Z" />
    <rect x="10" y="30" width="44" height="4" rx="2" ry="2" />
    <path d="M52,41.96C52,49.71,43.71,56,34,56H30C20.29,56,12,49.71,12,41.96a2.5,2.5,0,0,1,0-.27C12,38.75,16.42,34,26,34h12C47.58,34,52,38.75,52,41.69A2.5,2.5,0,0,1,52,41.96Z" />
  </svg>
);

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-background to-secondary/30 p-6 text-center">
      <MacaronLogo className="h-24 w-24 mb-6 text-primary" />
      <h1 className="text-5xl font-bold text-primary mb-4">Welcome to Macaroom!</h1>
      <p className="text-xl text-foreground/80 mb-8 max-w-2xl">
        Your sweet companion for crafting delightful experiences. Discover, plan, and share moments with friends, infused with a touch of magic.
      </p>
      <div className="space-x-4">
        <Button asChild size="lg">
          <Link href="/feed">
            Explore Plans <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/login">
            Login or Sign Up
          </Link>
        </Button>
      </div>
      <p className="mt-12 text-sm text-muted-foreground">
        Crafted with <span className="text-accent">♥</span> using Next.js and Genkit.
      </p>
    </div>
  );
}
