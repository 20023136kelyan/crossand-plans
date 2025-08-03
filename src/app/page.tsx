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
  X,
  Activity
} from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';
import { useState } from 'react';

const CrossandLogo = ({ className }: { className?: string }) => (
  <img src="/images/crossand-logo.svg" alt="Crossand Logo" className={className} />
);

const FeatureCard = ({ icon: Icon, title, description, delay = 0 }: { icon: any, title: string, description: string, delay?: number }) => (
  <div className="group animate-fade-in" style={{ animationDelay: `${delay}ms` }}>
    <div className="relative bg-white rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all duration-500 border border-gray-100 hover:border-orange-200 overflow-hidden group-hover:scale-[1.02] transform-gpu h-full">
      {/* Background gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-orange-50/50 to-yellow-50/50 opacity-0 group-hover:opacity-100 transition-all duration-500 rounded-3xl"></div>
      
      {/* Content */}
      <div className="relative z-10 text-center h-full flex flex-col">
        {/* Icon container */}
        <div className="mx-auto mb-8 relative">
          <div className="relative p-6 rounded-3xl bg-gradient-to-br from-orange-100 to-yellow-100 w-fit group-hover:scale-110 transition-all duration-500 shadow-lg group-hover:shadow-xl">
            <Icon className="h-10 w-10 text-orange-600 group-hover:text-orange-700 transition-colors duration-300" />
            
            {/* Floating accent dots */}
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-gradient-to-r from-orange-400 to-yellow-400 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-500 group-hover:scale-125"></div>
            <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-700 group-hover:scale-110"></div>
          </div>
          
          {/* Pulse ring effect on hover */}
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-orange-300 to-yellow-300 opacity-0 group-hover:opacity-30 transition-all duration-500 animate-ping group-hover:animate-pulse"></div>
        </div>
        
        {/* Text content */}
        <div className="flex-1 flex flex-col">
          <h3 className="text-2xl font-bold mb-6 text-gray-800 group-hover:text-orange-700 transition-colors duration-300 leading-tight">{title}</h3>
          <p className="text-gray-600 leading-relaxed text-lg group-hover:text-gray-700 transition-colors duration-300 flex-1">{description}</p>
          
          {/* Hover indicator */}
          <div className="mt-6 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
            <div className="inline-flex items-center text-orange-600 font-semibold text-sm">
              Learn more
              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
            </div>
          </div>
        </div>
      </div>
      
      {/* Decorative corner elements */}
      <div className="absolute top-4 right-4 w-2 h-2 bg-orange-300 rounded-full opacity-40 group-hover:scale-150 group-hover:opacity-100 transition-all duration-500"></div>
      <div className="absolute bottom-4 left-4 w-1.5 h-1.5 bg-yellow-300 rounded-full opacity-30 group-hover:scale-125 group-hover:opacity-80 transition-all duration-700"></div>
    </div>
  </div>
);

const TestimonialCard = ({ name, role, content, rating, delay = 0 }: { name: string, role: string, content: string, rating: number, delay?: number }) => (
  <div className="group animate-fade-in" style={{ animationDelay: `${delay}ms` }}>
    <div className="relative bg-white rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all duration-500 border border-gray-100 hover:border-yellow-200 overflow-hidden group-hover:scale-[1.02] transform-gpu">
      {/* Background gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-yellow-50/50 to-amber-50/50 opacity-0 group-hover:opacity-100 transition-all duration-500 rounded-3xl"></div>
      
      {/* Content */}
      <div className="relative z-10">
        {/* Star rating */}
        <div className="flex items-center gap-1 mb-6">
          {[...Array(rating)].map((_, i) => (
            <div key={i} className="relative">
              <Star className="h-5 w-5 text-yellow-400 fill-current group-hover:scale-110 transition-transform duration-300" style={{ transitionDelay: `${i * 50}ms` }} />
            </div>
          ))}
        </div>
        
        {/* Quote icon and content */}
        <div className="mb-8">
          <div className="relative">
            <Quote className="h-10 w-10 text-yellow-200 mb-6 group-hover:text-yellow-300 transition-colors duration-300" />
            <div className="absolute -top-1 -left-1 w-3 h-3 bg-gradient-to-r from-yellow-400 to-amber-400 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-500 group-hover:scale-150"></div>
          </div>
          <p className="text-gray-700 leading-relaxed text-lg font-medium group-hover:text-gray-800 transition-colors duration-300">
            "{content}"
          </p>
        </div>
        
        {/* User info */}
        <div className="flex items-center gap-4">
          {/* Avatar placeholder */}
          <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg group-hover:scale-110 transition-transform duration-300">
            {name.charAt(0)}
          </div>
          <div className="flex-1">
            <p className="font-bold text-gray-800 text-lg group-hover:text-yellow-700 transition-colors duration-300">{name}</p>
            <p className="text-sm text-gray-500 font-medium group-hover:text-gray-600 transition-colors duration-300">{role}</p>
          </div>
          {/* Badge */}
          <div className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-bold group-hover:bg-yellow-200 transition-colors duration-300">
            Beta User
          </div>
        </div>
      </div>
      
      {/* Decorative elements */}
      <div className="absolute top-4 right-4 w-2 h-2 bg-yellow-300 rounded-full opacity-60 group-hover:scale-150 group-hover:opacity-100 transition-all duration-500"></div>
      <div className="absolute bottom-4 left-4 w-1.5 h-1.5 bg-amber-300 rounded-full opacity-40 group-hover:scale-125 group-hover:opacity-80 transition-all duration-700"></div>
    </div>
  </div>
);

const PricingCard = ({ title, price, period, features, highlighted = false, buttonText = "Get Started" }: { 
  title: string, price: string, period: string, features: string[], highlighted?: boolean, buttonText?: string 
}) => (
  <div className={`relative bg-white rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-all duration-500 group ${highlighted ? 'ring-4 ring-orange-300 ring-opacity-50 transform scale-105 bg-gradient-to-br from-orange-50 to-yellow-50' : 'hover:scale-102'}`}>
    {/* Background gradient for highlighted card */}
    {highlighted && (
      <div className="absolute inset-0 bg-gradient-to-br from-orange-100/30 to-yellow-100/30 rounded-3xl" />
    )}
    
    {/* Content */}
    <div className="relative z-10">
      {highlighted && (
        <div className="text-center mb-6">
          <span className="inline-flex items-center bg-gradient-to-r from-orange-500 to-yellow-500 text-white px-6 py-2 rounded-full text-sm font-bold shadow-lg">
            <Star className="mr-2 h-4 w-4" />
            Most Popular
          </span>
        </div>
      )}
      
      <div className="text-center mb-8">
        <h3 className="text-2xl font-bold text-gray-900 mb-3">{title}</h3>
        <div className="flex items-baseline justify-center mb-2">
          <span className="text-5xl font-bold bg-gradient-to-r from-orange-600 to-yellow-600 bg-clip-text text-transparent">
            {price}
          </span>
          <span className="text-lg text-gray-500 font-medium ml-1">/{period}</span>
        </div>
        {highlighted && (
          <p className="text-sm text-orange-600 font-medium">Save 20% with annual billing</p>
        )}
      </div>
      
      <ul className="space-y-4 mb-10">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start gap-3 group-hover:translate-x-1 transition-transform duration-300" style={{ transitionDelay: `${index * 50}ms` }}>
            <div className={`p-1 rounded-full ${highlighted ? 'bg-gradient-to-r from-orange-500 to-yellow-500' : 'bg-orange-100'}`}>
              <Check className={`h-3 w-3 ${highlighted ? 'text-white' : 'text-orange-600'}`} />
            </div>
            <span className="text-gray-700 font-medium">{feature}</span>
          </li>
        ))}
      </ul>
      
      {highlighted ? (
        <div className="relative group/button">
          {/* Glowing background effect */}
          <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-400 via-yellow-400 to-orange-400 rounded-2xl blur opacity-75 group-hover/button:opacity-100 transition duration-500"></div>
          
          <Button 
            onClick={(e) => e.preventDefault()}
            className="relative w-full py-4 rounded-2xl font-bold text-lg text-white border-none ring-0 outline-none hover:scale-105 hover:shadow-xl transition-all duration-300 overflow-hidden" 
            style={{background: 'linear-gradient(to right, hsl(30, 100%, 50%), hsl(43, 100%, 55%))'}}
          >
            <div className="absolute inset-0 -translate-x-full group-hover/button:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
            <span className="relative z-20 flex items-center justify-center">
              {buttonText}
              <ArrowRight className="ml-2 h-5 w-5 group-hover/button:translate-x-1 transition-transform duration-300" />
            </span>
          </Button>
        </div>
      ) : (
        <Button 
          onClick={(e) => e.preventDefault()}
          className="w-full py-4 rounded-2xl font-bold text-lg bg-gray-100 text-gray-800 hover:bg-gray-200 hover:scale-105 transition-all duration-300 border border-gray-200 hover:border-gray-300"
        >
          {buttonText}
        </Button>
      )}
    </div>
  </div>
);

const FAQItem = ({ question, answer, index = 0 }: { question: string, answer: string, index?: number }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="group animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
      <div className={`bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-500 border border-gray-100 hover:border-orange-200 overflow-hidden ${isOpen ? 'ring-2 ring-orange-100 shadow-xl' : ''}`}>
        <button
          className="w-full text-left p-8 flex justify-between items-center hover:bg-gradient-to-r hover:from-orange-50 hover:to-yellow-50 transition-all duration-300 group-hover:scale-[1.01] transform-gpu"
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className="font-bold text-gray-800 text-lg pr-4 group-hover:text-orange-700 transition-colors">
            {question}
          </span>
          <div className={`flex-shrink-0 p-2 rounded-full transition-all duration-300 ${isOpen ? 'bg-gradient-to-r from-orange-500 to-yellow-500 rotate-180' : 'bg-gray-100 group-hover:bg-orange-100'}`}>
            <ChevronDown className={`h-5 w-5 transition-all duration-300 ${isOpen ? 'text-white' : 'text-gray-500 group-hover:text-orange-600'}`} />
          </div>
        </button>
        
        <div className={`overflow-hidden transition-all duration-500 ease-in-out ${isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="px-8 pb-8">
            <div className="w-full h-px bg-gradient-to-r from-orange-200 via-yellow-200 to-orange-200 mb-6"></div>
            <p className="text-gray-600 leading-relaxed text-base animate-fade-in">
              {answer}
            </p>
          </div>
        </div>
      </div>
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
            <span className="text-xl font-bold text-gray-900">Crossand</span>
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
              
              <Button 
                onClick={(e) => e.preventDefault()}
                className="relative text-white font-medium px-6 py-2 rounded-full border-none ring-0 outline-none hover:scale-105 hover:shadow-xl group overflow-hidden transition-all duration-300" 
                style={{background: 'linear-gradient(to right, hsl(43, 100%, 55%), hsl(30, 100%, 50%))'}}
              >
                {/* Shimmer effect overlay */}
                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                
                <span className="relative z-20 font-bold tracking-wide flex items-center">
                  Join Waitlist
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
                </span>
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
                  
                  <Button 
                    onClick={(e) => e.preventDefault()}
                    className="relative w-full text-white font-medium py-3 rounded-full border-none ring-0 outline-none hover:scale-105 hover:shadow-xl group overflow-hidden transition-all duration-300" 
                    style={{background: 'linear-gradient(to right, hsl(43, 100%, 55%), hsl(30, 100%, 50%))'}}
                  >
                    {/* Shimmer effect overlay */}
                    <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                    
                    <span className="relative z-20 font-bold tracking-wide flex items-center justify-center">
                      Join Waitlist
                      <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
                    </span>
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
      icon: Users,
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
      icon: Activity,
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
      role: "Beta Tester",
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
      question: "Does Crossand integrate with my existing apps and calendar?",
      answer: "Yes! Crossand seamlessly integrates with popular calendar apps, messaging platforms, and social media to provide a unified experience. Our AI works with your existing workflow rather than replacing it, making it easy to implement relationship management into your current digital habits."
    },
    {
      question: "What makes Crossand's AI different from other relationship apps?",
      answer: "Crossand's AI goes beyond simple reminders or basic scheduling. Our advanced machine learning models analyze communication patterns, relationship dynamics, and emotional context to provide truly intelligent insights. We focus on relationship quality, not quantity, to help you nurture meaningful connections rather than just managing contact lists."
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      {/* Hero Section */}
      <section id="hero" className="relative bg-white overflow-hidden pt-16">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-50 to-yellow-50 opacity-60" />
        <div className="relative max-w-7xl mx-auto px-6 py-20 lg:py-32">
          <div className="text-center animate-fade-in">
            <h1 className="font-bold text-5xl lg:text-7xl text-gray-900 mb-8 leading-tight">
              Monitor your social landscape.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r" style={{backgroundImage: 'linear-gradient(to right, hsl(30, 100%, 50%), hsl(43, 100%, 55%))'}}>
                Strengthen every connection
              </span>
            </h1>
            
            <p className="text-xl lg:text-2xl text-gray-600 mb-12 max-w-4xl mx-auto leading-relaxed">
              Crossand uses data analytics and AI to monitor your social landscape, keep track of your relationships, and detect when connections begin to fade. We prompt the right kind of interaction at the right time. From making your messages more interactive and meaningful to planning get-togethers. No stress. No overthinking. Just real connection.
            </p>

            {/* Keep the existing Join Waitlist button exactly as it is */}
            <div className="flex justify-center items-center mb-12">
              <div className="relative group">
                {/* Glowing background effect */}
                <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-400 via-yellow-400 to-orange-400 rounded-full blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
                
                <Button 
                  size="lg" 
                  onClick={(e) => e.preventDefault()}
                  className="relative text-xl font-semibold px-12 py-8 transition-all duration-300 rounded-full border-none ring-0 outline-none hover:scale-105 hover:shadow-2xl group overflow-hidden" 
                  style={{background: 'linear-gradient(to right, hsl(43, 100%, 55%), hsl(30, 100%, 50%))'}}
                >
                  {/* Shimmer effect overlay */}
                  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                  
                  <span className="relative z-20 text-white font-bold tracking-wide flex items-center">
                    Join Waitlist
                    <ArrowRight className="ml-3 h-6 w-6 text-white group-hover:translate-x-2 transition-transform duration-300" />
                  </span>
                </Button>
              </div>
            </div>


          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 bg-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
              How Crossand Works
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              From monitoring your social landscape to facilitating meaningful connections. Here's how we help you nurture relationships effortlessly.
            </p>
          </div>

          {/* Interactive Journey Flow */}
          <div className="relative max-w-6xl mx-auto">
            {/* Flowing Path SVG */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <svg 
                viewBox="0 0 800 400" 
                className="w-full h-full opacity-20"
                style={{ maxHeight: '400px' }}
              >
                <defs>
                  <linearGradient id="pathGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="hsl(30, 100%, 50%)" />
                    <stop offset="50%" stopColor="hsl(43, 100%, 55%)" />
                    <stop offset="100%" stopColor="hsl(30, 100%, 50%)" />
                  </linearGradient>
                </defs>
                
                {/* Flowing curved path */}
                <path
                  d="M 50 200 Q 200 100 350 200 Q 500 300 650 200 Q 750 150 750 200"
                  stroke="url(#pathGradient)"
                  strokeWidth="3"
                  fill="none"
                  className="animate-pulse"
                  strokeDasharray="10,5"
                />
                
                {/* Flowing dots animation */}
                <circle r="3" fill="hsl(30, 100%, 50%)">
                  <animateMotion
                    dur="4s"
                    repeatCount="indefinite"
                    path="M 50 200 Q 200 100 350 200 Q 500 300 650 200 Q 750 150 750 200"
                  />
                </circle>
                <circle r="2" fill="hsl(43, 100%, 55%)">
                  <animateMotion
                    dur="4s"
                    repeatCount="indefinite"
                    begin="1s"
                    path="M 50 200 Q 200 100 350 200 Q 500 300 650 200 Q 750 150 750 200"
                  />
                </circle>
              </svg>
            </div>

            {/* Steps Container */}
            <div className="relative grid grid-cols-1 lg:grid-cols-4 gap-8 lg:gap-4">
              {howItWorksSteps.map((step, idx) => (
                <div 
                  key={idx} 
                  className="group relative animate-fade-in cursor-pointer"
                  style={{ animationDelay: `${idx * 200}ms` }}
                >
                  {/* Step Container */}
                  <div className="relative z-10 text-center">
                    {/* Step Number & Icon */}
                    <div className="flex flex-col items-center mb-6">
                      {/* Animated Step Number */}
                      <div className="relative mb-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-orange-100 to-yellow-100 rounded-full flex items-center justify-center mb-2 group-hover:scale-110 transition-all duration-500 group-hover:shadow-xl">
                          <span className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-yellow-600 bg-clip-text text-transparent group-hover:scale-110 transition-transform duration-300">
                            {idx + 1}
                          </span>
                        </div>
                        
                        {/* Pulse ring on hover */}
                        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-orange-400 to-yellow-400 opacity-0 group-hover:opacity-30 transition-all duration-500 animate-ping group-hover:animate-pulse"></div>
                      </div>

                      {/* Icon with enhanced interactions */}
                      <div className="relative">
                        <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-3xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-lg group-hover:shadow-2xl">
                          <step.icon className="h-10 w-10 text-white group-hover:scale-110 transition-transform duration-300" />
                        </div>
                        
                        {/* Floating particles on hover */}
                        <div className="absolute -top-2 -right-2 w-3 h-3 bg-yellow-400 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-500 group-hover:animate-bounce"></div>
                        <div className="absolute -bottom-2 -left-2 w-2 h-2 bg-orange-400 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-700 group-hover:animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="space-y-4">
                      <h3 className="text-xl lg:text-2xl font-bold text-gray-800 group-hover:text-orange-600 transition-colors duration-300 leading-tight">
                        {step.title}
                      </h3>
                      
                      <p className="text-gray-600 group-hover:text-gray-700 transition-colors duration-300 leading-relaxed lg:text-sm xl:text-base">
                        {step.description}
                      </p>
                      
                      {/* Interactive progress indicator */}
                      <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
                        <div className="w-full bg-gray-200 rounded-full h-1">
                          <div 
                            className="bg-gradient-to-r from-orange-500 to-yellow-500 h-1 rounded-full transition-all duration-1000 group-hover:animate-pulse"
                            style={{ width: `${((idx + 1) / howItWorksSteps.length) * 100}%` }}
                          ></div>
                        </div>
                        <div className="mt-2 text-xs text-orange-600 font-medium">
                          Step {idx + 1} of {howItWorksSteps.length}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Background glow effect on hover */}
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-50/50 to-yellow-50/50 rounded-3xl opacity-0 group-hover:opacity-100 transition-all duration-500 -z-10 scale-95 group-hover:scale-100"></div>
                  
                  {/* Connection line to next step (hidden on last item) */}
                  {idx < howItWorksSteps.length - 1 && (
                    <div className="hidden lg:block absolute top-16 -right-2 w-8 h-0.5 bg-gradient-to-r from-orange-300 to-yellow-300 opacity-30 group-hover:opacity-60 transition-opacity duration-300"></div>
                  )}
                </div>
              ))}
            </div>

            {/* Interactive Call-to-Action */}
            <div className="text-center mt-16">
              <div className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-full border-2 border-orange-200 hover:border-orange-300 transition-all duration-300 hover:scale-105 group cursor-pointer">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-orange-400 rounded-full animate-pulse"></div>
                  <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }}></div>
                  <div className="w-3 h-3 bg-orange-400 rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
                </div>
                <span className="mx-4 font-semibold text-gray-700 group-hover:text-orange-600 transition-colors">
                  Ready to start your journey?
                </span>
                <ArrowRight className="h-5 w-5 text-orange-500 group-hover:translate-x-1 transition-transform duration-300" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-gray-50 relative overflow-hidden">
        {/* Background decorations */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-32 left-10 w-32 h-32 bg-orange-300 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-32 right-16 w-40 h-40 bg-yellow-300 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
          <div className="absolute top-1/2 right-1/4 w-24 h-24 bg-orange-200 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '4s' }}></div>
        </div>
        
        {/* Floating feature icons */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-24 right-12 opacity-10 animate-pulse">
            <Star className="h-12 w-12 text-orange-400 rotate-12" />
          </div>
          <div className="absolute bottom-24 left-12 opacity-10 animate-pulse" style={{ animationDelay: '3s' }}>
            <Heart className="h-14 w-14 text-yellow-400 -rotate-12" />
          </div>
        </div>
        
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <div className="inline-flex items-center px-6 py-3 rounded-full bg-gradient-to-r from-orange-100 to-yellow-100 text-orange-800 font-bold text-sm mb-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
              <Zap className="mr-3 h-5 w-5" />
              Powerful Features
            </div>
            <h2 className="text-5xl lg:text-6xl font-bold text-gray-900 mb-8 leading-tight">
              Crossand Features
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Experience our core AI-powered relationship management tools that are already helping 100+ users strengthen their connections and build meaningful relationships.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
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
          
          {/* Feature highlights */}
          <div className="bg-white/70 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-gray-200/50 max-w-5xl mx-auto">
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                Why Choose Our Features?
              </h3>
              <p className="text-gray-600 text-lg">
                Built with cutting-edge AI and designed for real human connections.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                             <div className="text-center group">
                 <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                   <Star className="h-8 w-8 text-white" />
                 </div>
                 <h4 className="font-bold text-gray-900 mb-2 group-hover:text-orange-600 transition-colors duration-300">AI-Powered</h4>
                 <p className="text-gray-600 text-sm">Advanced machine learning models</p>
               </div>
              
              <div className="text-center group">
                <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Shield className="h-8 w-8 text-white" />
                </div>
                <h4 className="font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors duration-300">Privacy First</h4>
                <p className="text-gray-600 text-sm">Your data stays secure & private</p>
              </div>
              
              <div className="text-center group">
                <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Heart className="h-8 w-8 text-white" />
                </div>
                <h4 className="font-bold text-gray-900 mb-2 group-hover:text-green-600 transition-colors duration-300">Human-Centered</h4>
                <p className="text-gray-600 text-sm">Built for meaningful relationships</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Beta Success Section */}
      <section className="py-20 bg-white relative overflow-hidden">
        {/* Background decorations */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-24 left-16 w-32 h-32 bg-green-300 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-24 right-16 w-40 h-40 bg-emerald-300 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-28 h-28 bg-blue-300 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '4s' }}></div>
        </div>
        
        {/* Floating success icons */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-32 right-12 opacity-10 animate-pulse">
            <TrendingUp className="h-16 w-16 text-green-400 rotate-12" />
          </div>
          <div className="absolute bottom-32 left-12 opacity-10 animate-pulse" style={{ animationDelay: '3s' }}>
            <Zap className="h-12 w-12 text-emerald-400 -rotate-12" />
          </div>
        </div>
        
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <div className="inline-flex items-center px-6 py-3 rounded-full bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 font-bold text-sm mb-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
              <TrendingUp className="mr-3 h-5 w-5" />
              Beta Success Story
            </div>
            <h2 className="text-5xl lg:text-6xl font-bold text-gray-900 mb-8 leading-tight">
              From Idea to Reality
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-yellow-500">
                in Just 2 Months
              </span>
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Our rapid development and early validation demonstrate the strong demand for meaningful relationship technology. Here's our incredible journey so far.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            <div className="group animate-fade-in">
              <div className="relative text-center bg-white rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all duration-500 border border-gray-100 hover:border-blue-200 overflow-hidden group-hover:scale-[1.02] transform-gpu">
                {/* Background gradient overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 opacity-0 group-hover:opacity-100 transition-all duration-500 rounded-3xl"></div>
                
                {/* Content */}
                <div className="relative z-10">
                  <div className="relative mx-auto mb-8">
                    <div className="w-24 h-24 mx-auto bg-gradient-to-br from-blue-500 to-blue-600 rounded-3xl flex items-center justify-center group-hover:scale-110 transition-all duration-500 shadow-lg group-hover:shadow-xl">
                      <Clock className="h-12 w-12 text-white group-hover:rotate-12 transition-transform duration-500" />
                    </div>
                    {/* Floating accent dots */}
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-gradient-to-r from-blue-400 to-indigo-400 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-500 group-hover:scale-125"></div>
                    <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-gradient-to-r from-indigo-400 to-blue-400 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-700 group-hover:scale-110"></div>
                  </div>
                  
                  <h3 className="text-4xl font-bold text-gray-900 mb-4 group-hover:text-blue-700 transition-colors duration-300">2 Months</h3>
                  <p className="text-gray-600 leading-relaxed group-hover:text-gray-700 transition-colors duration-300">From start to beta launch with full app skeleton and core features</p>
                  
                  {/* Progress indicator */}
                  <div className="mt-6 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full w-full animate-pulse"></div>
                    </div>
                  </div>
                </div>
                
                {/* Decorative corner elements */}
                <div className="absolute top-4 right-4 w-2 h-2 bg-blue-300 rounded-full opacity-40 group-hover:scale-150 group-hover:opacity-100 transition-all duration-500"></div>
              </div>
            </div>

            <div className="group animate-fade-in" style={{ animationDelay: '200ms' }}>
              <div className="relative text-center bg-white rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all duration-500 border border-gray-100 hover:border-purple-200 overflow-hidden group-hover:scale-[1.02] transform-gpu">
                {/* Background gradient overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-purple-50/50 to-pink-50/50 opacity-0 group-hover:opacity-100 transition-all duration-500 rounded-3xl"></div>
                
                {/* Content */}
                <div className="relative z-10">
                  <div className="relative mx-auto mb-8">
                    <div className="w-24 h-24 mx-auto bg-gradient-to-br from-purple-500 to-purple-600 rounded-3xl flex items-center justify-center group-hover:scale-110 transition-all duration-500 shadow-lg group-hover:shadow-xl">
                      <Users className="h-12 w-12 text-white group-hover:scale-110 transition-transform duration-500" />
                    </div>
                    {/* Floating accent dots */}
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-500 group-hover:scale-125"></div>
                    <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-gradient-to-r from-pink-400 to-purple-400 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-700 group-hover:scale-110"></div>
                  </div>
                  
                  <h3 className="text-4xl font-bold text-gray-900 mb-4 group-hover:text-purple-700 transition-colors duration-300">100+ Users</h3>
                  <p className="text-gray-600 leading-relaxed group-hover:text-gray-700 transition-colors duration-300">30 beta testers + 70 users acquired completely organically with zero marketing spend</p>
                  
                  {/* User count animation */}
                  <div className="mt-6 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
                    <div className="flex justify-center space-x-1">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 200}ms` }}></div>
                      ))}
                    </div>
                  </div>
                </div>
                
                {/* Decorative corner elements */}
                <div className="absolute top-4 right-4 w-2 h-2 bg-purple-300 rounded-full opacity-40 group-hover:scale-150 group-hover:opacity-100 transition-all duration-500"></div>
              </div>
            </div>

            <div className="group animate-fade-in" style={{ animationDelay: '400ms' }}>
              <div className="relative text-center bg-white rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all duration-500 border border-gray-100 hover:border-green-200 overflow-hidden group-hover:scale-[1.02] transform-gpu">
                {/* Background gradient overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-green-50/50 to-emerald-50/50 opacity-0 group-hover:opacity-100 transition-all duration-500 rounded-3xl"></div>
                
                {/* Content */}
                <div className="relative z-10">
                  <div className="relative mx-auto mb-8">
                    <div className="w-24 h-24 mx-auto bg-gradient-to-br from-green-500 to-green-600 rounded-3xl flex items-center justify-center group-hover:scale-110 transition-all duration-500 shadow-lg group-hover:shadow-xl">
                      <Zap className="h-12 w-12 text-white group-hover:rotate-12 transition-transform duration-500" />
                    </div>
                    {/* Floating accent dots */}
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-gradient-to-r from-green-400 to-emerald-400 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-500 group-hover:scale-125"></div>
                    <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-gradient-to-r from-emerald-400 to-green-400 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-700 group-hover:scale-110"></div>
                  </div>
                  
                  <h3 className="text-4xl font-bold text-gray-900 mb-4 group-hover:text-green-700 transition-colors duration-300">Strong Validation</h3>
                  <p className="text-gray-600 leading-relaxed group-hover:text-gray-700 transition-colors duration-300">Early user feedback helping us rapidly iterate on what people actually want</p>
                  
                  {/* Validation indicator */}
                  <div className="mt-6 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
                    <div className="inline-flex items-center text-green-600 font-semibold text-sm">
                      <Check className="mr-2 h-4 w-4" />
                      Validated
                    </div>
                  </div>
                </div>
                
                {/* Decorative corner elements */}
                <div className="absolute top-4 right-4 w-2 h-2 bg-green-300 rounded-full opacity-40 group-hover:scale-150 group-hover:opacity-100 transition-all duration-500"></div>
              </div>
            </div>
          </div>
          
          {/* Enhanced conclusion */}
          <div className="bg-gray-50/70 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-gray-200/50 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="inline-flex items-center mb-6">
                <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mr-4">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900">Ready for What's Next</h3>
              </div>
              <p className="text-lg text-gray-600 leading-relaxed mb-6">
                This early success validates our vision and positions us for rapid growth. We're building something people genuinely want and need.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <div className="inline-flex items-center text-green-600 font-semibold">
                  <Check className="mr-2 h-5 w-5" />
                  Product-Market Fit Achieved
                </div>
                <div className="inline-flex items-center text-blue-600 font-semibold">
                  <Star className="mr-2 h-5 w-5" />
                  Organic Growth Proven
                </div>
                <div className="inline-flex items-center text-purple-600 font-semibold">
                  <Heart className="mr-2 h-5 w-5" />
                  User Love Confirmed
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Section */}
      <section id="testimonials" className="py-20 bg-gray-100 relative overflow-hidden">
        {/* Background decorations */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-20 left-20 w-40 h-40 bg-yellow-300 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-20 w-32 h-32 bg-amber-300 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
          <div className="absolute top-1/2 left-1/3 w-24 h-24 bg-orange-300 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '4s' }}></div>
        </div>
        
        {/* Floating testimonial quotes */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-32 left-10 opacity-10 animate-pulse">
            <Quote className="h-16 w-16 text-yellow-400 rotate-12" />
          </div>
          <div className="absolute bottom-32 right-10 opacity-10 animate-pulse" style={{ animationDelay: '3s' }}>
            <Quote className="h-20 w-20 text-amber-400 -rotate-12" />
          </div>
        </div>
        
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <div className="inline-flex items-center px-6 py-3 rounded-full bg-gradient-to-r from-yellow-100 to-amber-100 text-yellow-800 font-bold text-sm mb-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
              <Star className="mr-3 h-5 w-5" />
              What Beta Users Say
            </div>
            <h2 className="text-5xl lg:text-6xl font-bold text-gray-900 mb-8 leading-tight">
              Real connections.
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 to-amber-500">
                Guaranteed results
              </span>
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Don't just take our word for it. Here's what our beta community is saying about their transformation in building meaningful relationships.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
            {testimonials.map((testimonial, idx) => (
              <TestimonialCard 
                key={idx}
                {...testimonial}
                delay={idx * 200}
              />
            ))}
          </div>
          
          {/* Community stats */}
          <div className="bg-white/70 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-gray-200/50 max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
              <div className="group">
                <div className="text-4xl font-bold text-gray-900 mb-2 group-hover:text-yellow-400 transition-colors duration-300">100+</div>
                <p className="text-gray-600 font-medium">Happy Beta Users</p>
              </div>
              <div className="group">
                <div className="text-4xl font-bold text-gray-900 mb-2 group-hover:text-yellow-400 transition-colors duration-300">4.9/5</div>
                <p className="text-gray-600 font-medium">Average Rating</p>
              </div>
              <div className="group">
                <div className="text-4xl font-bold text-gray-900 mb-2 group-hover:text-yellow-400 transition-colors duration-300">95%</div>
                <p className="text-gray-600 font-medium">Would Recommend</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center px-6 py-3 rounded-full bg-gradient-to-r from-orange-100 to-red-100 text-orange-800 font-bold text-sm mb-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
              <TrendingUp className="mr-3 h-5 w-5" />
              Subscriptions
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
              Choose Your Plan
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
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
      <section id="faq" className="py-20 bg-gray-100 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-20 left-10 w-32 h-32 bg-orange-300 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-10 w-40 h-40 bg-yellow-300 rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-60 h-60 bg-orange-200 rounded-full blur-3xl"></div>
        </div>
        
        <div className="relative max-w-5xl mx-auto px-6">
          <div className="text-center mb-20">
            <div className="inline-flex items-center px-6 py-3 rounded-full bg-gradient-to-r from-blue-100 to-purple-100 text-blue-800 font-bold text-sm mb-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
              <Shield className="mr-3 h-5 w-5" />
              Questions & Answers
            </div>
            <h2 className="text-5xl lg:text-6xl font-bold text-gray-900 mb-8 leading-tight">
              Everything you need to know
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Get answers to the most common questions about how Crossand can transform the way you manage and nurture your relationships.
            </p>
          </div>

          <div className="space-y-6 max-w-4xl mx-auto">
            {faqItems.map((faq, idx) => (
              <FAQItem key={idx} {...faq} index={idx} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-orange-600 to-yellow-400 relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Floating geometric shapes */}
          <div className="absolute top-10 left-10 w-20 h-20 bg-white/10 rounded-full blur-xl animate-pulse"></div>
          <div className="absolute top-32 right-16 w-16 h-16 bg-white/15 rounded-full blur-lg animate-pulse" style={{ animationDelay: '2s' }}></div>
          <div className="absolute bottom-20 left-1/4 w-12 h-12 bg-white/20 rounded-full blur-md animate-pulse" style={{ animationDelay: '4s' }}></div>
          <div className="absolute bottom-32 right-1/3 w-24 h-24 bg-white/8 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '1s' }}></div>
          
          {/* Floating icons */}
          <div className="absolute top-24 right-24 opacity-10 animate-bounce">
            <Heart className="h-8 w-8 text-white rotate-12" />
          </div>
          <div className="absolute bottom-24 left-24 opacity-15 animate-bounce" style={{ animationDelay: '1.5s' }}>
            <Users className="h-10 w-10 text-white -rotate-12" />
          </div>
          <div className="absolute top-1/2 right-12 opacity-10 animate-bounce" style={{ animationDelay: '3s' }}>
            <Sparkles className="h-6 w-6 text-white rotate-45" />
          </div>
          
          {/* Gradient overlay patterns */}
          <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/5 to-transparent animate-pulse"></div>
        </div>

        <div className="relative max-w-5xl mx-auto px-6 text-center">
          {/* Enhanced Header Section */}
          <div className="mb-12">
            {/* Pre-title badge */}
            <div className="inline-flex items-center px-6 py-3 bg-white/20 backdrop-blur-sm rounded-full border border-white/30 text-white font-bold text-sm mb-8 shadow-lg hover:scale-105 transition-all duration-300 group cursor-pointer">
              <div className="w-2 h-2 bg-white rounded-full mr-3 animate-pulse"></div>
              <span className="group-hover:scale-105 transition-transform duration-300">Ready to Transform?</span>
              <div className="w-2 h-2 bg-white rounded-full ml-3 animate-pulse" style={{ animationDelay: '1s' }}></div>
            </div>

            {/* Main heading with enhanced typography */}
            <h2 className="text-4xl lg:text-6xl font-bold text-white mb-8 leading-tight">
              <span className="block">Transform how you</span>
              <span className="block relative">
                <span className="relative z-10">nurture relationships</span>
                {/* Underline decoration */}
                <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 w-full h-2 bg-white/30 rounded-full blur-sm"></div>
              </span>
            </h2>
            
            {/* Enhanced description */}
            <div className="max-w-3xl mx-auto">
              <p className="text-xl lg:text-2xl text-white/95 mb-4 leading-relaxed font-medium">
                Join our exclusive waitlist and be among the first to experience AI-powered relationship management.
              </p>
              <div className="inline-flex items-center bg-white/20 backdrop-blur-sm rounded-full px-6 py-3 text-white font-semibold">
                <Star className="h-5 w-5 mr-2 text-yellow-300" />
                Early subscribers get special perks!
                <Sparkles className="h-5 w-5 ml-2 text-yellow-300" />
              </div>
            </div>
          </div>

          {/* Enhanced Button Section */}
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-400 via-yellow-400 to-orange-400 rounded-full blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
                
                <Button 
                  size="lg" 
                  onClick={(e) => e.preventDefault()}
                  className="relative text-white px-8 py-4 rounded-full font-semibold text-lg border-none ring-0 outline-none hover:scale-105 hover:shadow-xl group overflow-hidden transition-all duration-300" 
                  style={{background: 'linear-gradient(to right, hsl(43, 100%, 55%), hsl(30, 100%, 50%))'}}
                >
                  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                  
                  <span className="relative z-20 font-bold tracking-wide flex items-center">
                    Join Waitlist
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform duration-300" />
                  </span>
                </Button>
              </div>
              <div className="relative group/updates">
                {/* Subtle glowing border effect */}
                <div className="absolute -inset-0.5 bg-gradient-to-r from-white/40 to-white/60 rounded-full blur-sm opacity-50 group-hover/updates:opacity-100 transition duration-500"></div>
                
                <Button 
                  size="lg" 
                  onClick={(e) => e.preventDefault()}
                  className="relative bg-white/10 backdrop-blur-sm border-2 border-white/30 text-white hover:bg-white/20 hover:border-white/50 px-8 py-4 rounded-full font-bold text-lg transition-all duration-300 hover:scale-105 hover:shadow-xl group-hover/updates:shadow-2xl"
                >
                  <Mail className="mr-2 h-5 w-5 group-hover/updates:rotate-12 transition-transform duration-300" />
                  Get Updates
                </Button>
              </div>
            </div>

            {/* Social proof indicators */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mt-8 text-white/80">
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="w-8 h-8 bg-white/20 rounded-full border-2 border-white/30 flex items-center justify-center text-xs font-bold text-white">
                      {String.fromCharCode(65 + i)}
                    </div>
                  ))}
                  <div className="w-8 h-8 bg-white/30 rounded-full border-2 border-white/50 flex items-center justify-center text-xs font-bold text-white">
                    +
                  </div>
                </div>
                <span className="text-sm font-medium">100+ users already joined</span>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 text-yellow-300 fill-current" />
                  ))}
                </div>
                <span className="text-sm font-medium">4.9/5 beta rating</span>
              </div>
            </div>
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
              <p className="text-gray-600 mb-6 leading-relaxed">
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


