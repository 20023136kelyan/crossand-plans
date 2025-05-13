
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, CalendarPlus, Users, Lightbulb } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-full space-y-12">
      <header className="text-center space-y-4">
        <h1 className="text-5xl font-bold tracking-tight text-primary">
          Welcome to PlanPal!
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Organize your group events effortlessly. From finding the perfect spot with AI to managing expenses, PlanPal has you covered.
        </p>
      </header>

      <div className="relative w-full max-w-3xl aspect-[16/9] rounded-lg overflow-hidden shadow-2xl">
        <Image
          src="https://picsum.photos/seed/planpalhome/1200/675"
          alt="Group of friends having fun"
          fill={true}
          style={{ objectFit: "cover" }}
          data-ai-hint="friends event"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <div className="absolute bottom-6 left-6 text-white">
          <h2 className="text-3xl font-semibold">Seamless Planning, Memorable Moments</h2>
          <p className="text-lg">Focus on the fun, let us handle the details.</p>
        </div>
      </div>

      <section className="py-8 text-center">
        <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg">
          <Link href="/plans/create/initiate"> {/* Updated href */}
            <CalendarPlus className="mr-2 h-5 w-5" /> Create Your Next Plan
          </Link>
        </Button>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
        <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarPlus className="text-accent" />
              Create New Plans
            </CardTitle>
            <CardDescription>
              Easily set up new events, invite friends, and define all the important details.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p>Specify date, time, location, budget, and more. Get everyone on the same page quickly.</p>
          </CardContent>
          <CardFooter>
            <Button asChild variant="default" className="w-full bg-accent hover:bg-accent/90">
              <Link href="/plans/create/initiate"> {/* Updated href */}
                Start Planning <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardFooter>
        </Card>

        <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="text-accent" />
              AI Event Suggestions
            </CardTitle>
            <CardDescription>
              Get smart recommendations for activities and locations based on your group&apos;s preferences.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p>Our AI helps you discover new ideas tailored to your plan and participants.</p>
          </CardContent>
          <CardFooter>
             <Button asChild variant="outline" className="w-full">
              <Link href="/plans">
                Explore Suggestions <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardFooter>
        </Card>

        <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="text-accent" />
              Manage Your Crew
            </CardTitle>
            <CardDescription>
              Keep track of your friends, their preferences, and availability for smoother planning.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p>Build your social circle within PlanPal and make organizing a breeze.</p>
          </CardContent>
          <CardFooter>
            <Button asChild variant="outline" className="w-full">
              <Link href="/profile">
                Update Your Profile <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </section>

      <footer className="text-center text-muted-foreground py-8">
        <p>&copy; {new Date().getFullYear()} PlanPal. All rights reserved.</p>
      </footer>
    </div>
  );
}

