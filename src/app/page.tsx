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
  Twitter,
  Instagram,
  Facebook,
  PlayCircle,
  Smartphone,
  BrainCircuit,
  MessageCircle,
  Calendar,
  UserPlus,
  TrendingUp,
  Route
} from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';
import { useState } from 'react';

const CrossandLogo = ({ className }: { className?: string }) => (
  <img src="/images/crossand-logo.svg" alt="Crossand Logo" className={className} />
);

const FeatureCard = ({ icon: Icon, title, description, delay = 0 }: { icon: any, title: string, description: string, delay?: number }) => (
  <Card className="group hover:shadow-2xl transition-all duration-500 hover:scale-105 border-border/50 bg-card/80 backdrop-blur-sm hover:bg-card/90 animate-fade-in" style={{ animationDelay: `${delay}ms` }}>
    <CardHeader className="text-center">
      <div className="mx-auto mb-4 p-3 rounded-full bg-gradient-primary/20 w-fit group-hover:bg-gradient-primary/30 transition-all duration-300 group-hover:scale-110">
        <Icon className="h-8 w-8 text-primary group-hover:text-primary/90 transition-colors" />
      </div>
      <CardTitle className="text-xl group-hover:text-primary transition-colors">{title}</CardTitle>
    </CardHeader>
    <CardContent>
      <CardDescription className="text-center text-muted-foreground group-hover:text-foreground transition-colors">{description}</CardDescription>
    </CardContent>
  </Card>
);

const TestimonialCard = ({ name, role, content, rating, delay = 0 }: { name: string, role: string, content: string, rating: number, delay?: number }) => (
  <Card className="bg-card/80 backdrop-blur-sm hover:shadow-xl transition-all duration-300 hover:scale-105 animate-fade-in" style={{ animationDelay: `${delay}ms` }}>
    <CardContent className="p-6">
      <div className="flex items-center gap-1 mb-4">
        {[...Array(rating)].map((_, i) => (
          <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
        ))}
      </div>
      <p className="text-foreground mb-4 italic">"{content}"</p>
      <div>
        <p className="font-semibold text-foreground">{name}</p>
        <p className="text-sm text-muted-foreground">{role}</p>
      </div>
    </CardContent>
  </Card>
);

const PricingCard = ({ title, price, period, features, highlighted = false, buttonText = "Get Started" }: { 
  title: string, price: string, period: string, features: string[], highlighted?: boolean, buttonText?: string 
}) => (
  <Card className={`relative ${highlighted ? 'ring-2 ring-primary shadow-2xl scale-105' : ''} bg-card/80 backdrop-blur-sm hover:shadow-xl transition-all duration-300 hover:scale-105`}>
    {highlighted && (
      <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-gradient-primary text-primary-foreground">
        Recommended
      </Badge>
    )}
    <CardHeader className="text-center">
      <CardTitle className="text-xl">{title}</CardTitle>
      <div className="text-3xl font-bold text-gradient-primary">
        {price}<span className="text-sm text-muted-foreground font-normal">/{period}</span>
      </div>
    </CardHeader>
    <CardContent className="space-y-4">
      <ul className="space-y-2">
        {features.map((feature, index) => (
          <li key={index} className="flex items-center gap-2">
            <Check className="h-4 w-4 text-primary" />
            <span className="text-sm">{feature}</span>
          </li>
        ))}
      </ul>
      <Button className={`w-full ${highlighted ? 'bg-gradient-primary hover:bg-gradient-primary-hover' : ''}`}>
        {buttonText}
      </Button>
    </CardContent>
  </Card>
);

const FAQItem = ({ question, answer }: { question: string, answer: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <Card className="bg-card/80 backdrop-blur-sm">
      <CardContent className="p-0">
        <button
          className="w-full text-left p-6 flex justify-between items-center hover:bg-muted/50 transition-colors"
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className="font-semibold">{question}</span>
          <ChevronDown className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
        {isOpen && (
          <div className="px-6 pb-6 text-muted-foreground animate-fade-in">
            {answer}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default function HomePage() {
  const { settings } = useSettings();

  const siteDescription = settings?.siteDescription || 'Sweeten your social planning with Crossand';

  const features = [
    {
      icon: Route,
      title: "Generated Full Itineraries",
      description: "Our AI creates complete plan itineraries tailored to your preferences, including activities, timing, and locations that make sense for your group."
    },
    {
      icon: Heart,
      title: "Personalized AI Assistant",
      description: "AI that learns about you and your relationships' preferences, making smarter suggestions for activities that everyone will enjoy."
    },
    {
      icon: Camera,
      title: "Share Plan Memories",
      description: "Capture and share photos, notes, and highlights from your completed plans, creating lasting memories for you and your friends."
    },
    {
      icon: Globe,
      title: "Explore & Copy Plans",
      description: "Discover amazing plans created by other users and copy them to your own collection. Get inspired by what others are doing in your area."
    },
    {
      icon: MessageCircle,
      title: "Integrated Chat Interface",
      description: "Communicate with your friends directly within the app. Coordinate plans, share updates, and stay connected all in one place."
    }
  ];

  const howItWorksSteps = [
    {
      icon: UserPlus,
      title: "Complete Your Profile",
      description: "Add your preferences, allergies, interests, and dislikes so our AI can learn exactly what makes you happy and what to avoid."
    },
    {
      icon: Heart,
      title: "Add Your People",
      description: "Connect with friends, partners, family, or anyone that matters to you. Build your circle of meaningful relationships."
    },
    {
      icon: Route,
      title: "Generate Perfect Plans",
      description: "Use a simple prompt to let our AI create plans that consider everyone's preferences, creating experiences everyone will love."
    },
    {
      icon: Camera,
      title: "Share Your Memories",
      description: "Post about your experiences and memories, sharing highlights with your network and inspiring others in the community."
    }
  ];

  const testimonials = [
    {
      name: "Sarah Chen",
      role: "Beta Tester",
      content: "The AI actually remembers that I'm vegetarian and my boyfriend hates crowded places! It creates plans that work perfectly for both of us with just one simple prompt.",
      rating: 5
    },
    {
      name: "Mike Rodriguez",
      role: "Early Supporter",
      content: "I love how easy it is to add my friends and family, then generate plans that consider everyone's preferences. No more arguments about where to go!",
      rating: 5
    },
    {
      name: "Emma Thompson",
      role: "Community Leader",
      content: "Being able to share our adventure memories as posts is amazing. It's like Instagram but for actual experiences, and it inspires others to try new things too.",
      rating: 5
    }
  ];

  const pricingPlans = [
    {
      title: "Free",
      price: "$0",
      period: "forever",
      features: [
        "Full app access",
        "20 plans per month",
        "Add unlimited friends & family",
        "Share memories and experiences",
        "Chat with your network",
        "Access to our standard AI model"
      ]
    },
    {
      title: "Pro",
      price: "$9.99",
      period: "month",
      features: [
        "Everything in Free",
        "Unlimited standard AI plans",
        "20 advanced AI plans per month",
        "Access to our newest AI model",
        "Early access to new features"
      ],
      highlighted: true
    }
  ];

  const faqItems = [
    {
      question: "Is my data private and secure?",
      answer: "Absolutely. We take your privacy extremely seriously. Your personal data is fully protected and we do not share your information with anyone. All data is encrypted and stored securely, ensuring your preferences, relationships, and plans remain completely private."
    },
    {
      question: "How does the AI planning work?",
      answer: "Our AI learns from your profile preferences (allergies, interests, dislikes) and considers everyone in your group when creating plans. Just give it a simple prompt like 'plan a fun Saturday afternoon' and it generates a complete itinerary that works for everyone."
    },
    {
      question: "What's the difference between the standard and advanced AI models?",
      answer: "The standard AI model is great for basic planning and works well for most situations. The advanced AI model has enhanced learning capabilities, better preference understanding, and creates more sophisticated, personalized plans."
    },
    {
      question: "What are the plan limits for each pricing tier?",
      answer: "Free users get 20 plans per month using our standard AI model. Pro users get unlimited standard AI plans plus 20 advanced AI plans per month, giving you the best of both worlds."
    },
    {
      question: "Can I add my friends and family to coordinate plans together?",
      answer: "Yes! You can add unlimited friends, family, partners, or anyone that matters to you. When creating plans, our AI considers everyone's preferences to make experiences that the whole group will enjoy."
    }
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative w-screen h-screen min-h-screen flex items-center justify-center overflow-hidden" style={{ backgroundImage: "url(/images/Homepage.jpg)", backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" }}>
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-accent/10 opacity-50" />
        <div className="relative w-full h-full flex flex-col items-center justify-center text-center z-10 px-6">
          <div className="animate-fade-in">
            {/* Glowing Logo */}
            <div className="relative flex justify-center items-center mb-8">
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="block w-56 h-56 rounded-full bg-gradient-primary/30 blur-3xl animate-pulse" />
              </span>
              <CrossandLogo className="h-32 w-32 mx-auto drop-shadow-lg relative z-10 hover:scale-110 transition-transform duration-300" />
            </div>

            <h1 className="font-audiowide text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight uppercase">
              DISCOVER. PLAN. CONNECT.
            </h1>
            <p className="font-[600] text-lg md:text-xl lg:text-2xl text-white mb-8 max-w-4xl mx-auto leading-relaxed" style={{ fontFamily: 'BarlowCondensed, sans-serif' }}>
              The relationship management platform that helps you nurture the connections that matter most. From friends and family to partners and colleagues, Crossand makes it effortless to plan together, communicate better, and never forget to show you care.
            </p>
            <div className="flex justify-center items-center mb-12">
              <div className="relative group">
                {/* Glowing background effect */}
                <div className="absolute -inset-0.5 bg-gradient-to-r from-primary via-accent to-primary rounded-full blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
                
                <Button asChild size="lg" className="relative text-xl font-semibold px-12 py-8 bg-gradient-primary hover:bg-gradient-primary-hover transition-all duration-300 rounded-full border-none ring-0 outline-none hover:scale-105 hover:shadow-2xl group overflow-hidden">
                  <Link href="/signup" className="relative z-10 flex items-center">
                    {/* Shimmer effect overlay */}
                    <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                    
                    <span className="relative z-20 text-white font-bold tracking-wide">Join Waitlist</span>
                    <ArrowRight className="relative z-20 ml-3 h-6 w-6 text-white group-hover:translate-x-2 transition-transform duration-300" />
                </Link>
              </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative py-20 bg-background">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <Badge variant="secondary" className="mb-4 bg-gradient-primary/10 text-primary">
              <Zap className="mr-2 h-4 w-4" />
              Powerful Features
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-gradient-primary">
              Current Features You Can Use Today
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Discover what Crossand can already do to help you plan better experiences and strengthen your relationships.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
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
          
          {/* More Features Coming Soon */}
          <div className="text-center mt-16">
            <Card className="max-w-md mx-auto bg-card/80 backdrop-blur-sm border-dashed border-2 border-primary/30 hover:border-primary/50 transition-colors duration-300">
              <CardContent className="p-8">
                <div className="mb-4">
                  <div className="w-16 h-16 mx-auto bg-gradient-primary/20 rounded-full flex items-center justify-center mb-4">
                    <Sparkles className="h-8 w-8 text-primary animate-pulse" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold mb-2 text-gradient-primary">More Features Coming Soon</h3>
                <p className="text-muted-foreground">
                  Smart reminders, relationship insights, group coordination, and many more features to help you nurture your connections.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <Badge variant="secondary" className="mb-4 bg-gradient-primary/10 text-primary">
              <Clock className="mr-2 h-4 w-4" />
              Simple Process
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              How Crossand Works
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              From discovering the perfect plan to sharing your memories - here's how to make the most of your time together.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {howItWorksSteps.map((step, idx) => (
              <Card key={idx} className="relative text-center bg-card/80 backdrop-blur-sm hover:shadow-xl transition-all duration-300 hover:scale-105 animate-fade-in" style={{ animationDelay: `${idx * 150}ms` }}>
                <CardContent className="p-6">
                  <div className="mb-4">
                    <div className="w-16 h-16 mx-auto bg-gradient-primary rounded-full flex items-center justify-center mb-4">
                      <step.icon className="h-8 w-8 text-white" />
                    </div>
                    <div className="absolute -top-3 -right-3 w-8 h-8 bg-gradient-primary rounded-full flex items-center justify-center text-white font-bold text-sm">
                      {idx + 1}
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                  <p className="text-muted-foreground">{step.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-6">
                  <div className="text-center mb-16">
          <Badge variant="secondary" className="mb-4 bg-gradient-primary/10 text-primary">
            <Star className="mr-2 h-4 w-4" />
            Early Access Feedback
          </Badge>
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Excitement is Building
          </h2>
                      <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
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
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <Badge variant="secondary" className="mb-4 bg-gradient-primary/10 text-primary">
              <TrendingUp className="mr-2 h-4 w-4" />
              Simple Pricing
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Choose Your Adventure
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Start with full access for free, or upgrade to unlock our most advanced AI planning capabilities.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {pricingPlans.map((plan, idx) => (
              <PricingCard key={idx} {...plan} />
            ))}
          </div>

          <div className="text-center mt-12">
            <p className="text-muted-foreground">
              Questions about our plans? <Link href="/contact" className="text-primary hover:underline">Get in touch</Link>
            </p>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <Badge variant="secondary" className="mb-4 bg-gradient-primary/10 text-primary">
              <Shield className="mr-2 h-4 w-4" />
              Questions & Answers
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Frequently Asked Questions
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Everything you need to know about how Crossand can transform the way you manage and nurture your relationships.
            </p>
          </div>

          <div className="max-w-3xl mx-auto space-y-4">
            {faqItems.map((faq, idx) => (
              <FAQItem key={idx} {...faq} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-20 bg-gradient-primary overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary to-accent opacity-90" />
        <div className="relative container mx-auto px-6 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Be Among the First to Experience Crossand
          </h2>
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            Join our exclusive waitlist and be among the first to transform how you manage your relationships. Early subscribers get special perks!
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" variant="secondary" className="text-lg px-8 py-6 rounded-full">
              <Link href="/signup">
                Join Waitlist <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="text-lg px-8 py-6 rounded-full border-white/30 text-white hover:bg-white/10">
              <Link href="/contact">
                <Mail className="mr-2 h-5 w-5" />
                Get Updates
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t">
        <div className="container mx-auto px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <CrossandLogo className="h-8 w-8" />
                <span className="text-xl font-bold">Crossand</span>
              </div>
              <p className="text-muted-foreground mb-4">
                The relationship management platform that helps you nurture the connections that matter most.
              </p>
              <div className="flex gap-4">
                <Link href="#" className="text-muted-foreground hover:text-primary transition-colors">
                  <Twitter className="h-5 w-5" />
                </Link>
                <Link href="#" className="text-muted-foreground hover:text-primary transition-colors">
                  <Instagram className="h-5 w-5" />
                </Link>
                <Link href="#" className="text-muted-foreground hover:text-primary transition-colors">
                  <Facebook className="h-5 w-5" />
                </Link>
              </div>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2">
                <li><Link href="/features" className="text-muted-foreground hover:text-primary transition-colors">Features</Link></li>
                <li><Link href="/pricing" className="text-muted-foreground hover:text-primary transition-colors">Pricing</Link></li>
                <li><Link href="/explore" className="text-muted-foreground hover:text-primary transition-colors">Explore</Link></li>
                <li><Link href="/mobile" className="text-muted-foreground hover:text-primary transition-colors">Mobile App</Link></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2">
                <li><Link href="/about" className="text-muted-foreground hover:text-primary transition-colors">About</Link></li>
                <li><Link href="/blog" className="text-muted-foreground hover:text-primary transition-colors">Blog</Link></li>
                <li><Link href="/careers" className="text-muted-foreground hover:text-primary transition-colors">Careers</Link></li>
                <li><Link href="/contact" className="text-muted-foreground hover:text-primary transition-colors">Contact</Link></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Support</h3>
              <ul className="space-y-2">
                <li><Link href="/help" className="text-muted-foreground hover:text-primary transition-colors">Help Center</Link></li>
                <li><Link href="/privacy" className="text-muted-foreground hover:text-primary transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="text-muted-foreground hover:text-primary transition-colors">Terms of Service</Link></li>
                <li><Link href="/status" className="text-muted-foreground hover:text-primary transition-colors">Status</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t mt-8 pt-8 text-center text-muted-foreground">
            <p>&copy; 2024 Crossand. All rights reserved. Made with ❤️ for people who value meaningful relationships.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
