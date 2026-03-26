
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, CalendarPlus, Users, Lightbulb } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-full py-10 space-y-20">
      <header className="text-center space-y-6 max-w-4xl px-4">
        <h1 className="text-6xl md:text-7xl font-extrabold tracking-tight bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_auto] animate-gradient text-transparent bg-clip-text">
          Welcome to PlanPal!
        </h1>
        <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Organize your group events effortlessly. From finding the perfect spot with AI to managing expenses, PlanPal has you covered.
        </p>
        <div className="pt-4">
          <Button asChild size="lg" className="rounded-full px-8 py-7 text-lg shadow-xl hover:scale-105 transition-all duration-300">
            <Link href="/plans/create/initiate">
              <CalendarPlus className="mr-3 h-6 w-6" /> Create Your Next Plan
            </Link>
          </Button>
        </div>
      </header>

      <div className="relative w-full max-w-5xl group">
        <div className="absolute -inset-1 bg-gradient-to-r from-primary to-accent rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
        <div className="relative aspect-[16/9] rounded-2xl overflow-hidden shadow-2xl">
          <Image
            src="https://picsum.photos/seed/planpalhome/1200/675"
            alt="Group of friends having fun"
            fill={true}
            style={{ objectFit: "cover" }}
            data-ai-hint="friends event"
            priority
            className="hover:scale-105 transition-transform duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          <div className="absolute bottom-10 left-10 text-white space-y-2">
            <h2 className="text-4xl font-bold">Seamless Planning</h2>
            <p className="text-xl opacity-90">Focus on the fun, let us handle the details.</p>
          </div>
        </div>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-6xl px-4">
        <Card className="border-none shadow-2xl bg-white/50 backdrop-blur-sm hover:-translate-y-2 transition-all duration-300">
          <CardHeader>
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <CalendarPlus className="text-primary h-6 w-6" />
            </div>
            <CardTitle className="text-2xl">Create New Plans</CardTitle>
            <CardDescription className="text-base">
              Easily set up new events, invite friends, and define all the important details.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Specify date, time, location, budget, and more. Get everyone on the same page quickly.</p>
          </CardContent>
          <CardFooter>
            <Button asChild variant="ghost" className="p-0 hover:bg-transparent text-primary font-semibold hover:translate-x-1 transition-transform">
              <Link href="/plans/create/initiate" className="flex items-center">
                Start Planning <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardFooter>
        </Card>

        <Card className="border-none shadow-2xl bg-white/50 backdrop-blur-sm hover:-translate-y-2 transition-all duration-300">
          <CardHeader>
            <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4">
              <Lightbulb className="text-accent h-6 w-6" />
            </div>
            <CardTitle className="text-2xl">AI Suggestions</CardTitle>
            <CardDescription className="text-base">
              Smart recommendations based on your group&apos;s unique preferences.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Our AI helps you discover new ideas tailored to your plan and participants.</p>
          </CardContent>
          <CardFooter>
             <Button asChild variant="ghost" className="p-0 hover:bg-transparent text-accent font-semibold hover:translate-x-1 transition-transform">
              <Link href="/plans" className="flex items-center">
                Explore Ideas <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardFooter>
        </Card>

        <Card className="border-none shadow-2xl bg-white/50 backdrop-blur-sm hover:-translate-y-2 transition-all duration-300">
          <CardHeader>
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <Users className="text-primary h-6 w-6" />
            </div>
            <CardTitle className="text-2xl">Manage Crew</CardTitle>
            <CardDescription className="text-base">
              Keep track of friends, preferences, and availability.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Build your social circle within PlanPal and make organizing a breeze.</p>
          </CardContent>
          <CardFooter>
            <Button asChild variant="ghost" className="p-0 hover:bg-transparent text-primary font-semibold hover:translate-x-1 transition-transform">
              <Link href="/profile" className="flex items-center">
                Your Profile <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </section>

      <footer className="text-center text-muted-foreground pt-10 pb-20 border-t w-full">
        <p>&copy; {new Date().getFullYear()} PlanPal. Crafted for memorable moments.</p>
      </footer>
    </div>
  );
}

