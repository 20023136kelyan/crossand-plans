
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from "@/components/ui/input";
import { format } from 'date-fns';
import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { fetchExplorePageDataAction } from '@/app/actions/exploreActions';
import { getUserLocationAction } from '@/app/actions/userActions'; // Removed unused user search actions
import { useToast } from '@/hooks/use-toast';
import { Plan, Profile, Category, City, SearchedUser, Influencer } from '@/types/user';
import { useAuth } from '@/context/AuthContext';
import { Loader2, MapPin, Calendar, Star, Search, Users, Heart, Share2, BookmarkPlus, Lock, Percent, Check, X, UserCheck, UserPlus, BadgeCheck, ArrowLeft, Layers, Crown } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { calculateEnhancedPlanScore } from '@/lib/utils/enhancedRanking'; // Updated import
import { useRouter } from 'next/navigation';
import type { UserPreferences, GeoPoint } from '@/types/user';


// Profile card for Day in the Life section
const ProfileCard = ({ profile }: { profile: Profile | Influencer }) => {
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      return format(date, 'dd/MM/yyyy');
    } catch (error) {
      return '';
    }
  };

  return (
    <div className="relative flex-shrink-0 w-[120px] h-[120px] bg-card rounded-2xl overflow-hidden">
      <div className="absolute inset-0">
        {profile.avatarUrl || profile.imageUrl ? (
          <Image
            src={profile.avatarUrl || profile.imageUrl!}
            alt={profile.name || 'Profile'}
            fill
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <span className="text-2xl font-semibold text-muted-foreground">
              {profile.name ? profile.name.charAt(0).toUpperCase() : 'P'}
            </span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-2 text-white">
        <h3 className="text-xs font-medium line-clamp-1">{profile.type || 'Person'}</h3>
        {formatDate(profile.date) && (
          <p className="text-[10px] opacity-90">{formatDate(profile.date)}</p>
        )}
        {profile.location && (
          <p className="text-[10px] opacity-90 line-clamp-1">{profile.location}</p>
        )}
      </div>
    </div>
  );
};

// Category card component
export const CategoryCard = ({ 
  name, 
  isSelected, 
  onClick,
  iconUrl 
}: { 
  name: string; 
  isSelected?: boolean; 
  onClick?: (e: React.MouseEvent) => void;
  iconUrl?: string;
}) => (
  <Button
    variant={isSelected ? "default" : "outline"}
    className={cn(
      "h-[90px] w-full text-base font-medium rounded-xl relative overflow-hidden",
      "border border-border/50 bg-card hover:bg-accent/10",
      isSelected && "border-primary bg-accent/20"
    )}
    onClick={(e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick?.(e);
    }}
  >
    <span className="text-base font-medium">
      {name}
    </span>
  </Button>
);

// City card component
const CityCard = ({ city, onSelect, isSelected }: { city: City; onSelect: () => void; isSelected: boolean }) => {
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      return format(date, 'dd/MM/yyyy');
    } catch (error) {
      return '';
    }
  };

  return (
    <div 
      className={cn(
        "relative flex-shrink-0 w-[160px] h-[160px] cursor-pointer overflow-hidden rounded-2xl",
        isSelected && "ring-2 ring-primary"
      )}
      onClick={onSelect}
    >
      <div className="absolute inset-0">
        {city.imageUrl ? (
          <Image
            src={city.imageUrl}
            alt={city.name}
            fill
            className="object-cover"
            sizes="160px"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <MapPin className="h-10 w-10 text-muted-foreground/50" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
        <h3 className="text-lg font-medium line-clamp-1">{city.name}</h3>
        {formatDate(city.date) && (
          <p className="text-sm opacity-90">{formatDate(city.date)}</p>
        )}
        {city.location && (
          <p className="text-sm opacity-90 line-clamp-1">{city.location}</p>
        )}
      </div>
    </div>
  );
};

// Section component
const Section = ({ 
  title, 
  children,
  viewAllHref,
  viewAllText = "View All",
  className = ""
}: { 
  title: string;
  children: React.ReactNode;
  viewAllHref?: string;
  viewAllText?: string;
  className?: string;
}) => (
  <section className="mb-6 w-full">
    <div className="flex justify-between items-center mb-3">
      <h2 className="text-xl font-semibold">{title}</h2>
      {viewAllHref && (
        <Link href={viewAllHref}>
          <Button variant="link" className="text-primary text-sm px-0">
            {viewAllText}
          </Button>
        </Link>
      )}
    </div>
    <div className={cn("w-full", className)}>
      {children}
    </div>
  </section>
);

// Plan card component
const PlanCard = ({ plan }: { plan: Plan }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user) {
      toast({
        title: "Login Required",
        description: "Please log in to save plans",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      // Add save plan logic here
      toast({
        title: "Plan Saved",
        description: "Plan has been added to My Macaroon",
      });
    } catch (error) {
      console.error('Error saving plan:', error);
      toast({
        title: "Error",
        description: "Failed to save plan",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  // Calculate the maximum available discount
  const maxDiscount = useMemo(() => {
    if (!plan.venues?.length) return 0;
    return Math.max(...plan.venues.map(v => v.discount));
  }, [plan.venues]);

  // Format date
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      return format(date, 'MMM d, yyyy');
    } catch (error) {
      return '';
    }
  };

  return (
    <Link href={`/p/${plan.id}`}>
      <div className="relative bg-card rounded-xl overflow-hidden border border-border/50 hover:border-border transition-colors">
        {/* Premium Badge */}
        {plan.isPremiumOnly && (
          <div className="absolute top-2 right-2 z-10">
            <Badge variant="premium" className="bg-gradient-to-r from-amber-500 to-amber-700">
              <Lock className="h-3 w-3 mr-1" />
              Premium
            </Badge>
          </div>
        )}

        {/* Discount Badge */}
        {maxDiscount > 0 && (
          <div className="absolute top-2 left-2 z-10">
            <Badge variant="secondary" className="bg-green-500/90 text-white">
              <Percent className="h-3 w-3 mr-1" />
              Up to {maxDiscount}% off
            </Badge>
          </div>
        )}

        {/* Main Image */}
        <div className="relative aspect-[2/1] bg-muted">
          {plan.photoHighlights?.[0] ? (
            <Image
              src={plan.photoHighlights[0]}
              alt={plan.name}
              fill
              className="object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Calendar className="h-8 w-8 text-muted-foreground/50" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold line-clamp-2">{plan.name}</h3>
              {plan.location && (
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                  <MapPin className="h-3 w-3" />
                  {plan.location}
                </p>
              )}
            </div>
            
            {/* Rating */}
            {plan.averageRating && (
              <div className="flex items-center gap-1 text-amber-500">
                <Star className="h-4 w-4 fill-current" />
                <span className="text-sm font-medium">{plan.averageRating.toFixed(1)}</span>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="flex items-center gap-3 mt-3 text-sm text-muted-foreground">
            {plan.participantsCount !== undefined && (
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                {plan.participantsCount}
              </div>
            )}
            {plan.likesCount !== undefined && (
              <div className="flex items-center gap-1">
                <Heart className="h-4 w-4" />
                {plan.likesCount}
              </div>
            )}
            {plan.sharesCount !== undefined && (
              <div className="flex items-center gap-1">
                <Share2 className="h-4 w-4" />
                {plan.sharesCount}
              </div>
            )}
            {plan.savesCount !== undefined && (
              <div className="flex items-center gap-1">
                <BookmarkPlus className="h-4 w-4" />
                {plan.savesCount}
              </div>
            )}
          </div>

          {/* Creator Info */}
          <div className="flex items-center gap-2 mt-3">
            <Avatar className="h-6 w-6">
              <AvatarImage src={plan.creatorAvatarUrl} />
              <AvatarFallback>
                {plan.creatorName?.[0]?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium">{plan.creatorName}</span>
              {plan.creatorIsVerified && (
                <BadgeCheck className="h-4 w-4 text-primary" />
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <BookmarkPlus className="h-4 w-4 mr-2" />
                  Add to My Macaroon
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </Link>
  );
};

// Search Results Card component (Placeholder - not currently used in this file after changes)
const SearchResultCard = ({ 
  user,
  onFriendAction
}: { 
  user: SearchedUser;
  onFriendAction: () => void;
}) => {
  // ... (implementation remains but is unused here)
  return null; 
};

// Navigation Card component
const NavigationCard = ({
  title,
  description,
  imageUrl,
  href,
  icon: Icon
}: {
  title: string;
  description: string;
  imageUrl?: string;
  href: string;
  icon: React.ElementType;
}) => (
  <Link href={href} onClick={(e) => e.stopPropagation()}>
    <div className="group relative h-[200px] rounded-2xl overflow-hidden bg-black/90">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent">
        {imageUrl && (
          <Image
            src={imageUrl}
            alt={title}
            fill
            className="object-cover transition-transform group-hover:scale-105 mix-blend-overlay opacity-30"
          />
        )}
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/20" />
      <div className="absolute inset-0 p-6 flex flex-col justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-white/10 backdrop-blur-sm">
            <Icon className="h-6 w-6 text-white" />
          </div>
        </div>
        <div>
          <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
          <p className="text-sm text-white/70">{description}</p>
        </div>
      </div>
      <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  </Link>
);

// Featured Plan Panel component
const FeaturedPlanPanel = ({ 
  plan,
  isAdmin,
  onRemoveFeature 
}: { 
  plan: Plan;
  isAdmin?: boolean;
  onRemoveFeature?: () => void;
}) => {
  const maxDiscount = useMemo(() => {
    if (!plan.venues?.length) return 0;
    return Math.max(...plan.venues.map(v => v.discount));
  }, [plan.venues]);

  return (
    <Link href={`/p/${plan.id}`}>
      <div className="group relative h-[500px] rounded-2xl overflow-hidden bg-black/90">
        {plan.photoHighlights?.[0] && (
          <Image
            src={plan.photoHighlights[0]}
            alt={plan.name}
            fill
            className="object-cover transition-transform group-hover:scale-105 opacity-70"
            sizes="(max-width: 768px) 100vw, 1000px"
            priority
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
        
        {/* Admin Controls */}
        {isAdmin && onRemoveFeature && (
          <div className="absolute top-4 right-4 z-10">
            <Button
              variant="destructive"
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                onRemoveFeature();
              }}
            >
              Remove Featured
            </Button>
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-4 left-4 flex flex-col gap-2">
          <Badge variant="premium" className="bg-gradient-to-r from-amber-500 to-amber-700">
            <Crown className="h-3 w-3 mr-1" />
            Featured
          </Badge>
          {plan.isPremiumOnly && (
            <Badge variant="premium" className="bg-gradient-to-r from-amber-500 to-amber-700">
              <Lock className="h-3 w-3 mr-1" />
              Premium
            </Badge>
          )}
          {maxDiscount > 0 && (
            <Badge variant="secondary" className="bg-green-500/90 text-white">
              <Percent className="h-3 w-3 mr-1" />
              Up to {maxDiscount}% off
            </Badge>
          )}
        </div>

        {/* Content */}
        <div className="absolute inset-x-0 bottom-0 p-6">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold text-white mb-3">{plan.name}</h2>
            {plan.description && (
              <p className="text-lg text-white/80 mb-4 line-clamp-2">{plan.description}</p>
            )}
            
            {/* Location */}
            {plan.location && (
              <p className="text-white/90 flex items-center gap-2 mb-4">
                <MapPin className="h-5 w-5" />
                {plan.location}
              </p>
            )}

            {/* Stats */}
            <div className="flex items-center gap-6 text-white/80">
              {plan.participantsCount !== undefined && (
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {plan.participantsCount}
                </div>
              )}
              {plan.likesCount !== undefined && (
                <div className="flex items-center gap-2">
                  <Heart className="h-5 w-5" />
                  {plan.likesCount}
                </div>
              )}
              {plan.averageRating && (
                <div className="flex items-center gap-2 text-amber-400">
                  <Star className="h-5 w-5 fill-current" />
                  <span className="font-medium">{plan.averageRating.toFixed(1)}</span>
                </div>
              )}
            </div>

            {/* Creator Info */}
            <div className="flex items-center gap-3 mt-6">
              <Avatar className="h-10 w-10 ring-2 ring-white/20">
                <AvatarImage src={plan.creatorAvatarUrl} />
                <AvatarFallback className="bg-primary/20 text-white">
                  {plan.creatorName?.[0]?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex items-center gap-2">
                <span className="text-lg font-medium text-white">{plan.creatorName}</span>
                {plan.creatorIsVerified && (
                  <BadgeCheck className="h-5 w-5 text-blue-400" />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};

interface ExplorePageData {
  featuredProfiles: Profile[];
  completedPlans: Plan[];
  featuredCities: City[];
  categories: Category[];
}

interface ExploreContentProps {
  initialData?: ExplorePageData;
  userPreferences?: UserPreferences | null;
}

export function ExploreContent({ initialData, userPreferences }: ExploreContentProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [userLocation, setUserLocation] = useState<{ 
    city: string; 
    country: string;
    coordinates?: GeoPoint;
  } | undefined>();
  const [selectedCity, setSelectedCity] = useState<string | undefined>();
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [viewMode, setViewMode] = useState<'all' | 'cities' | 'categories' | 'creators' | 'dayInLife'>('all');
  const [feedView, setFeedView] = useState<'forYou' | 'explore'>('explore');
  const [isTabsHeaderVisible, setIsTabsHeaderVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const scrollThreshold = 50;
  
  // Data states
  const [profiles, setProfiles] = useState<Profile[]>(initialData?.featuredProfiles || []);
  const [plans, setPlans] = useState<Plan[]>(initialData?.completedPlans || []);
  const [cities, setCities] = useState<City[]>(initialData?.featuredCities || []);
  const [categories, setCategories] = useState<Category[]>(initialData?.categories || []);
  // Removed searchResults and searchLoading as people search is not implemented here
  const [filteredPlans, setFilteredPlans] = useState<Plan[]>([]);
  const [featuredPlans, setFeaturedPlans] = useState<Plan[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [locationRequested, setLocationRequested] = useState(false);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Keep for debouncing if needed in future

  const categoryImages: Record<string, string> = {
    'ALL': '/images/categories/all.jpg',
    'ART': '/images/categories/art.jpg',
    'FITNESS': '/images/categories/fitness.jpg',
  };

  const requestLocation = useCallback(() => {
    if (navigator.geolocation) {
      setLocationRequested(true);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const coords: GeoPoint = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          };
          
          try {
            const response = await fetch(
              `https://maps.googleapis.com/maps/api/geocode/json?latlng=${coords.latitude},${coords.longitude}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
            );
            if (!response.ok) throw new Error(`Geocoding API error: ${response.status}`);
            const data = await response.json();
            if (data.status !== 'OK') throw new Error(`Geocoding failed: ${data.status}`);
            
            if (data.results?.[0]?.address_components) {
              const components = data.results[0].address_components;
              const city = components.find((c: any) => c.types.includes('locality'))?.long_name;
              const country = components.find((c: any) => c.types.includes('country'))?.long_name;
              if (city && country) {
                setUserLocation({ city, country, coordinates: coords });
              } else {
                throw new Error('Could not find city and country in geocoding results');
              }
            } else {
              throw new Error('No address components found in geocoding results');
            }
          } catch (error: any) {
            console.error('Error getting location details:', error);
            toast({ title: 'Location Error', description: error.message || 'Could not determine city.', variant: 'default', duration: 5000 });
          }
        },
        (error) => {
          console.error('Error getting geolocation:', error);
          toast({ title: 'Location Access Error', description: 'Could not access location. Please enable in browser settings.', variant: 'default', duration: 5000 });
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
      );
    } else {
      toast({ title: 'Location Not Supported', description: 'Browser does not support geolocation.', variant: 'default', duration: 5000 });
    }
  }, [toast]);

  useEffect(() => {
    if (user?.uid) {
      getUserLocationAction(user.uid).then(result => {
        if (result.success && result.data?.city && result.data?.country) {
          setUserLocation({ city: result.data.city, country: result.data.country });
        } else if (!locationRequested) {
          toast({ 
            title: 'Enable Location', 
            description: 'Enable location access for personalized recommendations.', 
            action: <Button onClick={requestLocation}>Enable</Button>,
            duration: 0 
          });
        }
      }).catch(err => {
        console.error("Error fetching user location:", err);
        if (!locationRequested) {
           toast({ 
            title: 'Location Unavailable', 
            description: 'Could not retrieve saved location. Want to enable it now?', 
            action: <Button onClick={requestLocation}>Enable</Button>,
            duration: 0 
          });
        }
      });
    }
  }, [user?.uid, toast, locationRequested, requestLocation]);

  const processExploreData = useCallback((allPlansData: Plan[], featuredCitiesData: City[], currentLocation?: { city: string; country: string; coordinates?: GeoPoint }) => {
    const scoredPlans = allPlansData.map(plan => ({
      ...plan,
      score: calculateEnhancedPlanScore(plan, currentLocation?.coordinates || null, userPreferences || undefined)
    })).sort((a, b) => b.score - a.score);

    setFeaturedPlans(scoredPlans.filter(plan => plan.featured));
    setPlans(scoredPlans.filter(plan => !plan.featured));

    const citiesWithScore = featuredCitiesData.map(city => ({
      ...city,
      score: scoredPlans
        .filter(p => p.city?.toLowerCase() === city.name?.toLowerCase())
        .reduce((acc, p) => acc + (p as any).score, 0) // Cast to any to access score
    })).sort((a, b) => b.score - a.score);
    setCities(citiesWithScore);
  }, [userPreferences]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchExplorePageDataAction(userLocation, false, 0, userPreferences);
      if (result.success && result.data) {
        setProfiles(result.data.featuredProfiles || []);
        processExploreData(result.data.completedPlans || [], result.data.featuredCities || [], userLocation);
        setCategories(result.data.categories || []);
      } else {
        toast({ title: 'Error', description: result.error || 'Failed to fetch explore data', variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to fetch explore data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [userLocation, userPreferences, processExploreData, toast]);

  useEffect(() => {
    if (initialData) {
      setProfiles(initialData.featuredProfiles || []);
      processExploreData(initialData.completedPlans || [], initialData.featuredCities || [], userLocation);
      setCategories(initialData.categories || []);
      setLoading(false);
    } else {
      fetchData();
    }
  }, [initialData, fetchData, processExploreData, userLocation]);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (Math.abs(currentScrollY - lastScrollY) < scrollThreshold / 3) return;
      if (currentScrollY > lastScrollY && currentScrollY > scrollThreshold && isTabsHeaderVisible) {
        setIsTabsHeaderVisible(false);
      } else if (currentScrollY < lastScrollY && !isTabsHeaderVisible) {
        setIsTabsHeaderVisible(true);
      }
      setLastScrollY(currentScrollY <= 0 ? 0 : currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY, isTabsHeaderVisible, scrollThreshold]);
  
  useEffect(() => {
    if (!plans) return;
    let newFilteredPlans = [...plans];
    if (selectedCategory && selectedCategory !== 'ALL') {
      newFilteredPlans = newFilteredPlans.filter(plan => plan.eventType?.toLowerCase() === selectedCategory.toLowerCase());
    }
    if (selectedCity) {
      newFilteredPlans = newFilteredPlans.filter(plan => plan.city?.toLowerCase() === selectedCity.toLowerCase());
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase().trim();
      newFilteredPlans = newFilteredPlans.filter(plan => 
        plan.name.toLowerCase().includes(term) ||
        plan.location?.toLowerCase().includes(term) ||
        plan.city?.toLowerCase().includes(term) ||
        plan.eventType?.toLowerCase().includes(term) ||
        plan.description?.toLowerCase().includes(term) ||
        plan.creatorName?.toLowerCase().includes(term) ||
        plan.creatorUsername?.toLowerCase().includes(term)
      );
    }
    setFilteredPlans(newFilteredPlans.sort((a,b) => calculateEnhancedPlanScore(b, userLocation?.coordinates || null, userPreferences) - calculateEnhancedPlanScore(a, userLocation?.coordinates || null, userPreferences)));
  }, [plans, selectedCategory, selectedCity, searchTerm, userLocation, userPreferences]);

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (user) {
        try {
          const idToken = await user.getIdToken();
          const response = await fetch('/api/admin/verify', { headers: { 'Authorization': `Bearer ${idToken}` } });
          const data = await response.json();
          setIsAdmin(data.isAdmin);
        } catch (error) { console.error('Error checking admin status:', error); }
      }
    };
    checkAdminStatus();
  }, [user]);

  const toggleFeatured = async (planId: string, newFeaturedStatus: boolean) => {
    if (user) {
      try {
        const idToken = await user.getIdToken();
        await fetch('/api/admin/plans/toggle-featured', { 
          method: 'POST', 
          headers: { 'Authorization': `Bearer ${idToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ planId, featured: newFeaturedStatus })
        });
        fetchData(); // Refresh data
        toast({ title: 'Success', description: `Plan ${newFeaturedStatus ? 'featured' : 'unfeatured'}.` });
      } catch (error) { 
        toast({ title: 'Error', description: 'Failed to update plan.', variant: 'destructive' });
      }
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setIsSearchActive(value.trim().length > 0);
    // Debounce logic removed as it was tied to unused searchLoading/searchResults
  };
  
  if (loading && !initialData) {
    return <div className="flex justify-center items-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden">
      <div className={cn(
        "sticky top-0 z-50 w-full bg-background/80 backdrop-blur-sm border-b border-border/30",
        "transition-transform duration-300 ease-in-out",
        !isTabsHeaderVisible && "-translate-y-full"
      )}>
        <div className="max-w-screen-2xl mx-auto w-full">
          <div className={cn(
            "sticky top-0 z-30 flex justify-center items-center transition-all duration-300 ease-in-out h-12 sm:h-14 py-2",
            isTabsHeaderVisible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0 pointer-events-none"
          )}>
            <div className={cn("grid grid-cols-2 p-0.5 rounded-lg max-w-xs sm:max-w-sm h-8 sm:h-9", "bg-card/70 backdrop-blur-md shadow-md")}>
              <Button variant="ghost" size="sm" onClick={() => router.push('/feed?tab=forYou')} className="text-xs sm:text-sm rounded h-full px-3 py-1.5 transition-colors duration-150 hover:bg-muted">For You</Button>
              <Button variant="default" size="sm" className="text-xs sm:text-sm rounded h-full px-3 py-1.5 transition-colors duration-150 bg-primary/20 text-primary shadow-sm">Explore</Button>
            </div>
          </div>
          <div className="px-4 py-3">
            <h2 className="text-lg font-semibold mb-2 text-center">Discover</h2>
            <div className="relative max-w-2xl mx-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                type="search" 
                placeholder="Search plans and places..." 
                className="pl-9 h-10 rounded-xl w-full pr-10" 
                value={searchTerm} 
                onChange={(e) => handleSearchChange(e.target.value)} 
                onKeyDown={(e) => e.key === 'Escape' && handleSearchChange('')} 
              />
              {searchTerm && <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8" onClick={() => handleSearchChange('')}><X className="h-4 w-4" /></Button>}
            </div>
          </div>
          <div className="px-4">
            <div className="flex gap-2 pb-3 overflow-x-auto hide-scrollbar max-w-2xl mx-auto">
              <Button variant={viewMode === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('all')} className="flex-shrink-0">All</Button>
              <Button variant={viewMode === 'cities' ? 'default' : 'outline'} size="sm" onClick={() => { setViewMode('cities'); router.push('/explore/cities', { scroll: false }); }} className="flex-shrink-0">Cities</Button>
              <Button variant={viewMode === 'categories' ? 'default' : 'outline'} size="sm" onClick={() => { setViewMode('categories'); router.push('/explore/categories', { scroll: false }); }} className="flex-shrink-0">Categories</Button>
              <Button variant={viewMode === 'creators' ? 'default' : 'outline'} size="sm" onClick={() => { setViewMode('creators'); router.push('/explore/creators', { scroll: false }); }} className="flex-shrink-0">Creators</Button>
              <Button variant={viewMode === 'dayInLife' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('dayInLife')} className="flex-shrink-0">Day in Life</Button>
            </div>
          </div>
        </div>
      </div>
      <main className="flex-1 overflow-auto">
        <div className="max-w-screen-2xl mx-auto w-full">
          <div className="px-4 py-6 relative">
             {isSearchActive && (
              <div className="mb-6">
                {filteredPlans.length === 0 && !loading && (
                  <div className="text-center py-8"><p className="text-muted-foreground">No plans found for "{searchTerm}"</p></div>
                )}
                {filteredPlans.length > 0 && (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredPlans.map(plan => (
                      <PlanCard key={plan.id} plan={plan} />
                    ))}
                  </div>
                )}
              </div>
            )}
            {!isSearchActive && viewMode === 'all' && (
              <>
                {featuredPlans.length > 0 && (
                  <Section title="Featured Plans" viewAllHref="/plans/featured" className="mb-12 overflow-hidden">
                    <div className="relative -mx-4 sm:mx-0">
                      <div className="flex overflow-x-auto gap-4 px-4 pb-4 snap-x snap-mandatory hide-scrollbar">
                        {featuredPlans.map((plan: Plan) => (
                          <div key={plan.id} className="flex-none w-[calc(100vw-2rem)] sm:w-[500px] md:w-[600px] lg:w-[800px] max-w-[1000px] snap-center">
                            <FeaturedPlanPanel plan={plan} isAdmin={isAdmin} onRemoveFeature={() => toggleFeatured(plan.id, false)} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </Section>
                )}
                {isAdmin && (
                  <Section title="Admin: Add to Featured" className="mb-12">
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {plans.slice(0, 6).map(plan => (
                        <div key={plan.id} className="relative group">
                          <PlanCard plan={plan} />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Button variant="default" onClick={() => toggleFeatured(plan.id, true)}><Crown className="h-4 w-4 mr-2" />Make Featured</Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}
                <Section title="Browse Plans" className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <NavigationCard title="Cities" description="Explore plans by location" href="/explore/cities" icon={MapPin} />
                  <NavigationCard title="Categories" description="Browse by interest" href="/explore/categories" icon={Layers} />
                  <NavigationCard title="Creators" description="Follow your favorite planners" href="/explore/creators" icon={Users} />
                  <NavigationCard title="Celebrity Plans" description="Experience a day in their life" href="/explore/celebrity" icon={Star} />
                </Section>
                
                {cities.length > 0 && (
                  <Section title="Popular Cities" viewAllHref="/explore/cities" className="overflow-hidden">
                    <div className="relative -mx-4 sm:mx-0">
                      <div className="flex gap-4 px-4 pb-4 overflow-x-auto snap-x snap-mandatory hide-scrollbar sm:grid sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                        {cities.slice(0, 6).map(city => (
                          <Link key={city.name} href={`/plans/city/${city.name}`} className="w-[160px] flex-none sm:w-full">
                            <CityCard city={city} onSelect={() => {}} isSelected={false} />
                          </Link>
                        ))}
                      </div>
                    </div>
                  </Section>
                )}
                {categories.length > 0 && (
                  <Section title="Popular Categories" viewAllHref="/explore/categories" className="overflow-hidden">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {categories.slice(0, 4).map(category => (
                        <Link key={category.name} href={`/plans/category/${encodeURIComponent(category.name)}`}>
                          <CategoryCard name={category.name} iconUrl={category.iconUrl} isSelected={false} />
                        </Link>
                      ))}
                    </div>
                  </Section>
                )}
                {profiles.length > 0 && (
                  <Section title="A Day in the Life Of" viewAllHref="/explore/creators" className="overflow-hidden">
                    <div className="relative -mx-4 sm:mx-0">
                      <div className="flex gap-4 px-4 pb-4 overflow-x-auto snap-x snap-mandatory hide-scrollbar sm:grid sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-8">
                        {profiles.map(profile => (
                          <Link key={profile.id} href={`/users/${profile.id}`} className="w-[140px] flex-none sm:w-full">
                            <ProfileCard profile={profile} />
                          </Link>
                        ))}
                      </div>
                    </div>
                  </Section>
                )}
                <Section title="Popular Plans" viewAllHref="/plans" className="space-y-6">
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {plans.slice(0, 6).map(plan => (
                      <PlanCard key={plan.id} plan={plan} />
                    ))}
                  </div>
                </Section>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

