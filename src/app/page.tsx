'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Heart, Users, Camera, MapPin, Globe, ArrowRight } from 'lucide-react';
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
      <CardDescription className="text-center text-white">{description}</CardDescription>
    </CardContent>
  </Card>
);

export default function HomePage() {
  const { settings } = useSettings();

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
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative w-screen h-screen min-h-screen flex items-center justify-center overflow-hidden" style={{ backgroundImage: "url(/images/Homepage.jpg)", backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" }}>
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-accent/10 opacity-50" />
        <div className="relative w-full h-full flex flex-col items-center justify-center text-center z-10">
          <div className="animate-fade-in">
            {/* Glowing Logo */}
            <div className="relative flex justify-center items-center mb-8">
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="block w-56 h-56 rounded-full bg-white opacity-90 blur-xl animate-pulse" />
              </span>
              <CrossandLogo className="h-32 w-32 mx-auto drop-shadow-lg relative z-10" />
            </div>
            <Badge variant="secondary" className="mb-6 px-4 py-2 text-sm font-medium">
              <Sparkles className="mr-2 h-4 w-4" />
              AI-Powered Activity Discovery Platform
            </Badge>
            <h1 className="font-audiowide text-6xl md:text-7xl font-bold text-white mb-6 leading-tight uppercase">
              WELCOME TO CROSSAND
            </h1>
            <p className="font-[600] text-xl md:text-2xl text-white mb-8 max-w-3xl mx-auto leading-relaxed" style={{ fontFamily: 'BarlowCondensed, sans-serif' }}>
              {siteDescription}. Our AI helps you discover curated activity templates from real experiences, empowering you to live more fully, be more present, and build lasting happiness through meaningful adventures.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button asChild size="lg" className="text-lg px-8 py-6 shadow-lg hover:shadow-xl transition-all duration-300 rounded-full">
                <Link href="/login">
                  Get Started Free <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="text-lg px-8 py-6 border-2 hover:bg-primary/5 rounded-full">
                <Link href="/explore">
                  Discover Activities
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Second Section */}
      <section
        className="relative w-screen h-screen flex items-center justify-center overflow-hidden bg-black"
        style={{
          backgroundImage: 'url(/images/homepage2.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundColor: '#000',
        }}
      >
        <div className="flex flex-col items-center justify-center text-center w-full h-full px-6">
          <h2 className="font-audiowide text-5xl md:text-7xl font-bold mb-14 text-white" style={{ textShadow: '0 2px 16px rgba(0,0,0,0.7)' }}>
            AI-Powered Journey to a Fuller Life
          </h2>
        </div>
      </section>

      {/* Features Section */}
      <section
        className="relative w-screen min-h-screen flex items-center justify-center bg-black py-20"
        style={{
          backgroundImage: 'url(/images/colors.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <div className="w-full flex flex-col items-center justify-center text-center px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto mt-8">
            {features.map((feature, idx) => (
              <FeatureCard key={idx} icon={feature.icon} title={feature.title} description={feature.description} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
