'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Users, MapPin, Star, ArrowRight, Sparkles, Heart, Share2, Camera, MessageSquare, Zap, Globe } from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';

const CrossandLogo = ({ className }: { className?: string }) => (
  <img src="/images/crossand-logo.svg" alt="Crossand Logo" className={className} />
);

const FeatureCard = ({ icon: Icon, title, description }: { icon: any, title: string, description: string }) => (
  <Card className="group hover:shadow-lg transition-all duration-300 hover:scale-105 border-border/50 bg-card/50 backdrop-blur-sm">
    <CardHeader className="text-center">
      <div className="mx-auto mb-4 p-3 rounded-full bg-primary/10 w-fit group-hover:bg-primary/20 transition-colors">
        <Icon className="h-8 w-8 text-primary" />
      </div>
      <CardTitle className="text-xl">{title}</CardTitle>
    </CardHeader>
    <CardContent>
      <CardDescription className="text-center text-muted-foreground">{description}</CardDescription>
    </CardContent>
  </Card>
);

export default function HomePage() {
  const { settings } = useSettings();
  
  const siteName = settings?.siteName || 'Macaroom';
  const siteDescription = settings?.siteDescription || 'Sweeten your social planning with Macaroom';

  const features = [
    {
      icon: Sparkles,
      title: "AI-Curated Discovery",
      description: "Our AI analyzes thousands of real experiences to surface activity templates that inspire you to live more actively and build genuine happiness."
    },
    {
      icon: Heart,
      title: "Personalized for You",
      description: "AI learns your preferences to recommend activities that align with your values, helping you be more present and engaged in life."
    },
    {
      icon: Globe,
      title: "Smart Activity Matching",
      description: "Advanced AI connects you with experiences that foster personal growth, meaningful connections, and authentic joy."
    },
    {
      icon: Users,
      title: "Build Deeper Connections",
      description: "AI helps coordinate group activities that strengthen relationships and create shared memories for lasting happiness."
    },
    {
      icon: Camera,
      title: "Mindful Experience Sharing",
      description: "Share your completed adventures as templates, inspiring others to live more fully while building a community of active, present individuals."
    },
    {
      icon: MapPin,
      title: "Location-Aware Wellness",
      description: "AI discovers local activities that promote well-being, encouraging you to explore your surroundings and stay actively engaged with the world."
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-accent/10 opacity-50" />
        <div className="relative container mx-auto px-6 py-20 text-center">
          <div className="animate-fade-in">
            <CrossandLogo className="h-32 w-32 mb-8 mx-auto drop-shadow-lg" />
            <Badge variant="secondary" className="mb-6 px-4 py-2 text-sm font-medium">
              <Sparkles className="mr-2 h-4 w-4" />
              AI-Powered Activity Discovery Platform
            </Badge>
            <h1 className="text-6xl md:text-7xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent font-redressed mb-6 leading-tight">
              Welcome to Crossand
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto leading-relaxed">
              {siteDescription}. Our AI helps you discover curated activity templates from real experiences, empowering you to live more fully, be more present, and build lasting happiness through meaningful adventures.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              <Button asChild size="lg" className="text-lg px-8 py-6 shadow-lg hover:shadow-xl transition-all duration-300">
                <Link href="/login">
                  Get Started Free <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="text-lg px-8 py-6 border-2 hover:bg-primary/5">
                <Link href="/explore">
                  Discover Activities
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gradient-to-b from-transparent to-muted/20">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
              AI-Powered Journey to a Fuller Life
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Our AI mission is to help you live more actively, be more present in the world, and build lasting happiness through meaningful experiences and authentic connections.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
            {features.map((feature, index) => (
              <div key={index} className="animate-slide-in-from-right" style={{ animationDelay: `${index * 100}ms` }}>
                <FeatureCard {...feature} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="py-20">
        <div className="container mx-auto px-6 text-center">
          <div className="max-w-4xl mx-auto">
            <h3 className="text-3xl md:text-4xl font-bold mb-8">
              AI Helping People Live More Fully
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
              <div className="p-6">
                <div className="text-4xl font-bold text-gradient-primary mb-2">10K+</div>
                <div className="text-muted-foreground">Activity Templates</div>
              </div>
              <div className="p-6">
                <div className="text-4xl font-bold text-gradient-primary mb-2">5K+</div>
                <div className="text-muted-foreground">Happy Adventurers</div>
              </div>
              <div className="p-6">
                <div className="text-4xl font-bold text-gradient-primary mb-2">50+</div>
                <div className="text-muted-foreground">Cities to Explore</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10">
        <div className="container mx-auto px-6 text-center">
          <div className="max-w-3xl mx-auto">
            <h3 className="text-4xl md:text-5xl font-bold mb-6">
              Ready to Live More Fully with AI?
            </h3>
            <p className="text-xl text-muted-foreground mb-8">
              Let our AI guide you toward a more active, present, and joyful life through personalized activity discovery that builds genuine happiness and meaningful connections.
            </p>
            <Button asChild size="lg" className="text-lg px-12 py-6 shadow-xl hover:shadow-2xl transition-all duration-300">
              <Link href="/login">
                Start Living More Fully - It's Free! <Heart className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border/30">
        <div className="container mx-auto px-6 text-center">
          <CrossandLogo className="h-12 w-12 mb-4 mx-auto" />
          <p className="text-muted-foreground mb-4">
            Crafted with <span className="text-accent">♥</span> using Next.js and Genkit.
          </p>
          <div className="flex justify-center space-x-6 text-sm text-muted-foreground">
            <Link href="/privacy" className="hover:text-primary transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-primary transition-colors">Terms</Link>
            <Link href="/contact" className="hover:text-primary transition-colors">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
