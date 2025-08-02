'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles,
  Heart,
  Users,
  Camera,
  MapPin,
  Globe,
  ArrowRight,
  Zap,
  Shield,
  Clock,
  Star,
  Check,
  ChevronDown,
  Mail,
  Instagram,
  Linkedin,
  PlayCircle,
  Smartphone,
  BrainCircuit,
  MessageCircle,
  Calendar,
  UserPlus,
  TrendingUp,
  Route,
  Quote,
  Menu,
  X
} from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';
import { useState } from 'react';

const CrossandLogo = ({ className }: { className?: string }) => (
  <img src="/images/crossand-logo.svg" alt="Crossand Logo" className={className} />
);

const FeatureCard = ({ icon: Icon, title, description, delay = 0 }: { icon: any, title: string, description: string, delay?: number }) => (
  <div className="group text-center p-8 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 shadow-xl hover:scale-105 transition-all duration-500 animate-fade-in" style={{ animationDelay: `${delay}ms` }}>
    <div className="mx-auto mb-6 p-4 rounded-2xl bg-gradient-to-br from-orange-100/80 to-yellow-100/80 backdrop-blur-sm w-fit group-hover:scale-110 transition-all duration-300">
      <Icon className="h-8 w-8 text-orange-600 group-hover:text-orange-700 transition-colors" />
    </div>
    <h3 className="text-xl font-bold mb-4 text-white">{title}</h3>
    <p className="text-white/90 leading-relaxed">{description}</p>
  </div>
);

const TestimonialCard = ({ name, role, content, rating, delay = 0 }: { name: string, role: string, content: string, rating: number, delay?: number }) => (
  <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 animate-fade-in" style={{ animationDelay: `${delay}ms` }}>
    <div className="flex items-center gap-1 mb-6">
      {[...Array(rating)].map((_, i) => (
        <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
      ))}
    </div>
    <div className="mb-6">
      <Quote className="h-8 w-8 text-orange-200 mb-4" />
      <p className="text-gray-700 leading-relaxed italic text-lg" style={{ fontFamily: 'BarlowCondensed' }}>"{content}"</p>
    </div>
    <div className="border-t pt-4">
      <p className="font-bold text-gray-800">{name}</p>
      <p className="text-sm text-gray-500">{role}</p>
    </div>
  </div>
);

const PricingCard = ({ title, price, period, features, highlighted = false, buttonText = "Get Started" }: {
  title: string, price: string, period: string, features: string[], highlighted?: boolean, buttonText?: string
}) => (
  <div className={`bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 ${highlighted ? 'ring-2 ring-orange-500 transform scale-105' : ''}`}>
    {highlighted && (
      <div className="text-center mb-4">
        <span className="bg-gradient-to-r from-orange-500 to-yellow-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
          Recommended
        </span>
      </div>
    )}
    <div className="text-center mb-8">
      <h3 className="text-2xl font-bold text-gray-800 mb-2">{title}</h3>
      <div className="text-4xl font-bold text-orange-600 mb-2">
        {price}<span className="text-lg text-gray-500 font-normal">/{period}</span>
      </div>
    </div>
    <ul className="space-y-4 mb-8">
      {features.map((feature, index) => (
        <li key={index} className="flex items-start gap-3">
          <Check className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" />
          <span className="text-gray-700">{feature}</span>
        </li>
      ))}
    </ul>
    <Button className={`w-full py-3 rounded-full font-semibold ${highlighted ? 'bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}>
      {buttonText}
    </Button>
  </div>
);

const FAQItem = ({ question, answer }: { question: string, answer: string }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <button
        className="w-full text-left p-6 flex justify-between items-center hover:bg-gray-50 transition-colors rounded-xl"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="font-semibold text-gray-800 text-lg">{question}</span>
        <ChevronDown className={`h-5 w-5 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="px-6 pb-6 text-gray-600 leading-relaxed animate-fade-in">
          {answer}
        </div>
      )}
    </div>
  );
};

// Add Navigation component
const Navigation = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setIsMobileMenuOpen(false); // Close mobile menu after navigation
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Company Name */}
          <div className="flex items-center gap-3">
            <CrossandLogo className="h-8 w-8" />
            <span className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Nova_Round' }}>Crossand</span>
          </div>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center space-x-8">
            <button
              onClick={() => scrollToSection('hero')}
              className="text-gray-700 hover:text-orange-600 font-medium transition-colors"
            >
              Home
            </button>
            <button
              onClick={() => scrollToSection('how-it-works')}
              className="text-gray-700 hover:text-orange-600 font-medium transition-colors"
            >
              How It Works
            </button>
            <button
              onClick={() => scrollToSection('features')}
              className="text-gray-700 hover:text-orange-600 font-medium transition-colors"
            >
              Features
            </button>
            <button
              onClick={() => scrollToSection('testimonials')}
              className="text-gray-700 hover:text-orange-600 font-medium transition-colors"
            >
              Testimonials
            </button>
            <button
              onClick={() => scrollToSection('pricing')}
              className="text-gray-700 hover:text-orange-600 font-medium transition-colors"
            >
              Pricing
            </button>
            <button
              onClick={() => scrollToSection('faq')}
              className="text-gray-700 hover:text-orange-600 font-medium transition-colors"
            >
              FAQ
            </button>
            <div className="relative group">
              {/* Glowing background effect */}
              <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-400 via-yellow-400 to-orange-400 rounded-full blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>

              <Button asChild className="relative text-white font-medium px-6 py-2 rounded-full border-none ring-0 outline-none hover:scale-105 hover:shadow-xl group overflow-hidden transition-all duration-300" style={{ background: 'linear-gradient(to right, hsl(43, 100%, 55%), hsl(30, 100%, 50%))' }}>
                <Link href="/signup" className="relative z-10 flex items-center">
                  {/* Shimmer effect overlay */}
                  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>

                  <span className="relative z-20 font-bold tracking-wide">Join Waitlist</span>
                  <ArrowRight className="relative z-20 ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
                </Link>
              </Button>
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="text-gray-700 hover:text-orange-600 transition-colors"
            >
              {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-200">
            <div className="px-6 py-4 space-y-4">
              <button
                onClick={() => scrollToSection('hero')}
                className="block w-full text-left text-gray-700 hover:text-orange-600 font-medium transition-colors py-2"
              >
                Home
              </button>
              <button
                onClick={() => scrollToSection('how-it-works')}
                className="block w-full text-left text-gray-700 hover:text-orange-600 font-medium transition-colors py-2"
              >
                How It Works
              </button>
              <button
                onClick={() => scrollToSection('features')}
                className="block w-full text-left text-gray-700 hover:text-orange-600 font-medium transition-colors py-2"
              >
                Features
              </button>
              <button
                onClick={() => scrollToSection('testimonials')}
                className="block w-full text-left text-gray-700 hover:text-orange-600 font-medium transition-colors py-2"
              >
                Testimonials
              </button>
              <button
                onClick={() => scrollToSection('pricing')}
                className="block w-full text-left text-gray-700 hover:text-orange-600 font-medium transition-colors py-2"
              >
                Pricing
              </button>
              <button
                onClick={() => scrollToSection('faq')}
                className="block w-full text-left text-gray-700 hover:text-orange-600 font-medium transition-colors py-2"
              >
                FAQ
              </button>
              <div className="pt-4">
                <div className="relative group">
                  {/* Glowing background effect */}
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-400 via-yellow-400 to-orange-400 rounded-full blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>

                  <Button asChild className="relative w-full text-white font-medium py-3 rounded-full border-none ring-0 outline-none hover:scale-105 hover:shadow-xl group overflow-hidden transition-all duration-300" style={{ background: 'linear-gradient(to right, hsl(43, 100%, 55%), hsl(30, 100%, 50%))' }}>
                    <Link href="/signup" className="relative z-10 flex items-center justify-center">
                      {/* Shimmer effect overlay */}
                      <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>

                      <span className="relative z-20 font-bold tracking-wide">Join Waitlist</span>
                      <ArrowRight className="relative z-20 ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default function HomePage() {
  const { settings } = useSettings();

  const siteDescription = settings?.siteDescription || 'Monitor your social landscape with AI';

  const features = [
    {
      icon: BrainCircuit,
      title: "AI Social Monitoring",
      description: "Our machine learning models analyze your social interactions and relationships to detect when connections begin to fade, prompting timely outreach."
    },
    {
      icon: Route,
      title: "Automated Social Planning",
      description: "Complete automated planning system with venue selection, calendar syncing, and bill splitting. Let AI handle the logistics while you focus on connection."
    },
    {
      icon: MessageCircle,
      title: "Interactive Messaging System",
      description: "Smart messaging that makes your conversations more interactive and helps you understand context lost in text messages, while providing interaction prompts based on your relationship dynamics."
    },
    {
      icon: TrendingUp,
      title: "Relationship Dashboard",
      description: "Comprehensive dashboard showing relationship health, interaction patterns, and personalized insights to help you maintain stronger connections."
    },
    {
      icon: Heart,
      title: "Emotion & Relationship Analysis",
      description: "Advanced ML models analyze emotional context and relationship dynamics to provide intelligent recommendations for meaningful interactions."
    },
    {
      icon: Calendar,
      title: "Smart Scheduling & Coordination",
      description: "Seamlessly coordinate with friends and family through integrated calendar syncing and group coordination features."
    }
  ];

  const howItWorksSteps = [
    {
      icon: UserPlus,
      title: "Connect Your Social Landscape",
      description: "Add your friends, family, and colleagues to build your relationship network. Our AI begins learning your interaction patterns and preferences."
    },
    {
      icon: BrainCircuit,
      title: "AI Monitors Relationships",
      description: "Our advanced ML models continuously analyze your social interactions to detect when connections begin to fade or need attention."
    },
    {
      icon: MessageCircle,
      title: "Receive Smart Prompts",
      description: "Get intelligent suggestions for the right kind of interaction at the right time. From making your messages more engaging to planning get-togethers."
    },
    {
      icon: Calendar,
      title: "Effortless Planning",
      description: "When it's time to meet up, our automated system handles venue selection, calendar syncing, and bill splitting so you can focus on connection."
    }
  ];

  const testimonials = [
    {
      name: "Sarah Chen",
      role: "Beta Tester",
      content: "The AI actually caught that I hadn't talked to my college friend in months and helped me understand the context of our past conversations to make my message more meaningful. It led to us planning a reunion weekend that we never would have organized otherwise!",
      rating: 5
    },
    {
      name: "Mike Rodriguez",
      role: "Early Supporter",
      content: "The automated planning system is incredible - it handled venue selection, synced our calendars, and even split the bill. I spent time connecting with friends instead of managing logistics.",
      rating: 5
    },
    {
      name: "Emma Thompson",
      role: "Beta Community Member",
      content: "The relationship dashboard opened my eyes to patterns I never noticed. I can see which friendships need attention and get prompts for meaningful interactions at just the right time.",
      rating: 5
    }
  ];

  const pricingPlans = [
    {
      title: "Free",
      price: "$0",
      period: "forever",
      features: [
        "Basic relationship monitoring",
        "Limited AI social planning",
        "Simple messaging features",
        "Basic relationship insights",
        "Community access"
      ]
    },
    {
      title: "Pro",
      price: "$2.99",
      period: "week",
      features: [
        "Everything in Free",
        "Advanced AI models",
        "Full social management system",
        "Advanced social planning features",
        "Complete interactive messaging",
        "Detailed relationship analytics",
        "Calendar syncing & bill splitting",
        "Priority support",
        "14-day free trial"
      ],
      highlighted: true,
      buttonText: "Start Free Trial"
    }
  ];

  const faqItems = [
    {
      question: "Is my data private and secure?",
      answer: "Absolutely. We take your privacy extremely seriously. Your personal data is fully protected and we do not share your information with anyone. All data is encrypted and stored securely, ensuring your preferences, relationships, and plans remain completely private."
    },
    {
      question: "How does the AI monitoring work?",
      answer: "Our AI learns from your interaction patterns and relationship history to detect when connections begin to fade. It analyzes communication frequency, engagement levels, and other factors to suggest the perfect time and type of outreach."
    },
    {
      question: "What's included in the automated planning?",
      answer: "Our system handles venue research and booking, calendar coordination across your group, bill splitting calculations, and even sends reminders. You just focus on enjoying time with your people."
    },
    {
      question: "How quickly can I see results?",
      answer: "Most users see improved relationship engagement within the first week. Our AI begins learning your patterns immediately and starts providing valuable insights and prompts within days."
    },
    {
      question: "Can I add my friends and family to coordinate plans together?",
      answer: "Yes! You can add unlimited friends, family, partners, or anyone that matters to you. When creating plans, our AI considers everyone's preferences to make experiences that the whole group will enjoy."
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      {/* Hero Section */}
      <section id="hero" className="relative bg-white overflow-hidden pt-16">
        {/* Background Image */}
        <img
          src="/images/Homepage.jpg"
          alt="Background"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ zIndex: 0 }}
        />
        <div className="relative max-w-7xl mx-auto px-6 py-12 lg:py-20">
          <div className="text-center animate-fade-in">
            {/* Crossand Logo */}
            <div className="mb-8 relative">
              {/* Seamless light glow effect */}
              <div className="absolute inset-0 bg-white/80 rounded-full blur-3xl animate-pulse shadow-2xl" style={{
                width: '300px',
                height: '300px',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                animation: 'pulse 3s ease-in-out infinite',
                boxShadow: '0 0 60px rgba(255, 255, 255, 0.8), 0 0 120px rgba(255, 255, 255, 0.4)'
              }}></div>
              <img
                src="/images/Crossand logo.png"
                alt="Crossand Logo"
                className="mx-auto h-40 w-auto relative z-10"
              />
            </div>

            <h1 className="font-bold text-5xl lg:text-7xl text-gray-900 mb-8 leading-tight">
              Monitor your social landscape,<br />
              <span className="text-black">
                strengthen every connection
              </span>
            </h1>

            <p className="text-xl lg:text-2xl text-white mb-12 max-w-4xl mx-auto leading-relaxed" style={{ fontFamily: 'BarlowCondensed' }}>
              Crossand uses data analytics and AI to monitor your social landscape, keep track of your relationships, and detect when connections begin to fade. We prompt the right kind of interaction at the right time. From making your messages more interactive and meaningful to planning get-togethers. No stress. No overthinking. Just real connection.
            </p>

            {/* Keep the existing Join Waitlist button exactly as it is */}
            <div className="flex justify-center items-center mb-12">
              <div className="relative group">
                {/* Glowing background effect */}
                <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-400 via-yellow-400 to-orange-400 rounded-full blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>

                <Button asChild size="lg" className="relative text-xl font-semibold px-12 py-8 transition-all duration-300 rounded-full border-none ring-0 outline-none hover:scale-105 hover:shadow-2xl group overflow-hidden" style={{ background: 'linear-gradient(to right, hsl(43, 100%, 55%), hsl(30, 100%, 50%))' }}>
                  <Link href="/signup" className="relative z-10 flex items-center">
                    {/* Shimmer effect overlay */}
                    <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>

                    <span className="relative z-20 text-white font-bold tracking-wide">Join Waitlist</span>
                    <ArrowRight className="relative z-20 ml-3 h-6 w-6 text-white group-hover:translate-x-2 transition-transform duration-300" />
                  </Link>
                </Button>
              </div>
            </div>

            {/* Hero Image Placeholder */}
            <div className="max-w-5xl mx-auto">
              <div className="bg-gradient-to-br from-orange-100 to-yellow-100 rounded-2xl p-8 shadow-xl">
                <div className="bg-white rounded-xl p-6 text-center">
                  <Users className="h-16 w-16 text-orange-600 mx-auto mb-4" />
                  <p className="text-gray-600">Interactive relationship dashboard preview</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
              How Crossand Works
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto" style={{ fontFamily: 'BarlowCondensed' }}>
              From monitoring your social landscape to facilitating meaningful connections - here's how we help you nurture relationships effortlessly.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {howItWorksSteps.map((step, idx) => (
              <div key={idx} className="text-center group animate-fade-in" style={{ animationDelay: `${idx * 150}ms` }}>
                <div className="relative mb-8">
                  <div className="w-20 h-20 mx-auto bg-gradient-to-br from-orange-500 to-yellow-500 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-all duration-300">
                    <step.icon className="h-10 w-10 text-white" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-8 h-8 bg-orange-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {idx + 1}
                  </div>
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-4">{step.title}</h3>
                <p className="text-gray-600 leading-relaxed" style={{ fontFamily: 'BarlowCondensed' }}>{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 relative overflow-hidden">
        {/* Background Image */}
        <img
          src="/images/homepage2.jpg"
          alt="Background"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ zIndex: 0 }}
        />
        <div className="relative max-w-7xl mx-auto px-6" style={{ zIndex: 2 }}>
          <div className="text-center mb-16">
            <span className="inline-flex items-center px-4 py-2 rounded-full bg-orange-100 text-orange-800 font-semibold text-sm mb-4">
              <Zap className="mr-2 h-4 w-4" />
              Powerful Features
            </span>
            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">
              Beta Features Available Now
            </h2>
            <p className="text-xl text-white/90 max-w-3xl mx-auto" style={{ fontFamily: 'BarlowCondensed' }}>
              Experience our core AI-powered relationship management tools that are already helping 100+ users strengthen their connections.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, idx) => (
              <FeatureCard
                key={idx}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                delay={idx * 100}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Beta Success Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="inline-flex items-center px-4 py-2 rounded-full bg-green-100 text-green-800 font-semibold text-sm mb-4">
              <TrendingUp className="mr-2 h-4 w-4" />
              Beta Success Story
            </span>
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
              From Idea to Reality in Just 2 Months
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto" style={{ fontFamily: 'BarlowCondensed' }}>
              Our rapid development and early validation show the strong demand for meaningful relationship technology.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="w-20 h-20 mx-auto bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mb-6">
                <Clock className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-3xl font-bold text-gray-900 mb-2">2 Months</h3>
              <p className="text-gray-600" style={{ fontFamily: 'BarlowCondensed' }}>From start to beta launch with full app skeleton and core features</p>
            </div>

            <div className="text-center bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="w-20 h-20 mx-auto bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mb-6">
                <Users className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-3xl font-bold text-gray-900 mb-2">100+ Users</h3>
              <p className="text-gray-600" style={{ fontFamily: 'BarlowCondensed' }}>30 beta testers + 70 users acquired completely organically with zero marketing spend</p>
            </div>

            <div className="text-center bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="w-20 h-20 mx-auto bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center mb-6">
                <Zap className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-3xl font-bold text-gray-900 mb-2">Strong Validation</h3>
              <p className="text-gray-600" style={{ fontFamily: 'BarlowCondensed' }}>Early user feedback helping us rapidly iterate on what people actually want</p>
            </div>
          </div>

          <div className="text-center mt-12">
            <p className="text-lg text-gray-600 max-w-2xl mx-auto" style={{ fontFamily: 'BarlowCondensed' }}>
              This early success validates our vision and positions us for rapid growth.
            </p>
          </div>
        </div>
      </section>

      {/* Social Proof Section */}
      <section id="testimonials" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="inline-flex items-center px-4 py-2 rounded-full bg-yellow-100 text-yellow-800 font-semibold text-sm mb-4">
              <Star className="mr-2 h-4 w-4" />
              What Beta Users Say
            </span>
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
              Real connections, guaranteed
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto" style={{ fontFamily: 'BarlowCondensed' }}>
              See what beta testers are saying about how Crossand is changing their approach to relationships.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, idx) => (
              <TestimonialCard
                key={idx}
                {...testimonial}
                delay={idx * 200}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="inline-flex items-center px-4 py-2 rounded-full bg-orange-100 text-orange-800 font-semibold text-sm mb-4">
              <TrendingUp className="mr-2 h-4 w-4" />
              Sustainable Growth Strategy
            </span>
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
              Choose Your Plan
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto" style={{ fontFamily: 'BarlowCondensed' }}>
              Start with core features for free, or unlock our latest AI models and social management tools. As we grow to 10,000+ local users, we'll partner with local businesses to create even more value for our community.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {pricingPlans.map((plan, idx) => (
              <PricingCard key={idx} {...plan} />
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="inline-flex items-center px-4 py-2 rounded-full bg-blue-100 text-blue-800 font-semibold text-sm mb-4">
              <Shield className="mr-2 h-4 w-4" />
              Questions & Answers
            </span>
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
              Frequently Asked Questions
            </h2>
            <p className="text-xl text-gray-600" style={{ fontFamily: 'BarlowCondensed' }}>
              Everything you need to know about how Crossand can transform the way you manage and nurture your relationships.
            </p>
          </div>

          <div className="space-y-4">
            {faqItems.map((faq, idx) => (
              <FAQItem key={idx} {...faq} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-orange-600 to-yellow-600">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">
            Transform how you nurture relationships
          </h2>
          <p className="text-xl text-white/90 mb-8" style={{ fontFamily: 'BarlowCondensed' }}>
            Join our exclusive waitlist and be among the first to experience AI-powered relationship management. Early subscribers get special perks!
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-400 via-yellow-400 to-orange-400 rounded-full blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>

              <Button asChild size="lg" className="relative text-white px-8 py-4 rounded-full font-semibold text-lg border-none ring-0 outline-none hover:scale-105 hover:shadow-xl group overflow-hidden transition-all duration-300" style={{ background: 'linear-gradient(to right, hsl(43, 100%, 55%), hsl(30, 100%, 50%))' }}>
                <Link href="/signup" className="relative z-10 flex items-center">
                  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>

                  <span className="relative z-20 font-bold tracking-wide">Join Waitlist</span>
                  <ArrowRight className="relative z-20 ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform duration-300" />
                </Link>
              </Button>
            </div>
            <Button asChild size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 px-8 py-4 rounded-full font-semibold text-lg">
              <Link href="/contact">
                <Mail className="mr-2 h-5 w-5" />
                Get Updates
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <CrossandLogo className="h-8 w-8" />
                <span className="text-xl font-bold text-gray-900">Crossand</span>
              </div>
              <p className="text-gray-600 mb-6 leading-relaxed" style={{ fontFamily: 'BarlowCondensed' }}>
                Monitor your social landscape with AI that detects fading connections and prompts meaningful interactions at the right time.
              </p>
              <div className="flex gap-4">
                <Link href="https://www.instagram.com/crossand.ai/" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-orange-600 transition-colors">
                  <Instagram className="h-5 w-5" />
                </Link>
                <Link href="https://www.linkedin.com/company/crossand/" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-orange-600 transition-colors">
                  <Linkedin className="h-5 w-5" />
                </Link>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-4">Company</h3>
              <ul className="space-y-2">
                <li><span className="text-gray-600 hover:text-orange-600 transition-colors cursor-pointer">About</span></li>
                <li><span className="text-gray-600 hover:text-orange-600 transition-colors cursor-pointer">Blog</span></li>
                <li><span className="text-gray-600 hover:text-orange-600 transition-colors cursor-pointer">Careers</span></li>
                <li><span className="text-gray-600 hover:text-orange-600 transition-colors cursor-pointer">Contact</span></li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-4">Support</h3>
              <ul className="space-y-2">
                <li><span className="text-gray-600 hover:text-orange-600 transition-colors cursor-pointer">Help Center</span></li>
                <li><span className="text-gray-600 hover:text-orange-600 transition-colors cursor-pointer">Privacy Policy</span></li>
                <li><span className="text-gray-600 hover:text-orange-600 transition-colors cursor-pointer">Terms of Service</span></li>
                <li><span className="text-gray-600 hover:text-orange-600 transition-colors cursor-pointer">Status</span></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-200 mt-8 pt-8 text-center text-gray-500">
            <p>&copy; 2024 Crossand. All rights reserved. Made with ❤️ for people who value meaningful relationships.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

