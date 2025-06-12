
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from "@/components/ui/input";
import { format } from 'date-fns';
import React, { useEffect, useState, useMemo, useRef, useCallback, startTransition } from 'react';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { fetchExplorePageDataAction, searchCollectionsAction } from '@/app/actions/exploreActions';
import { getUserLocationAction, searchUsersAction } from '@/app/actions/userActions';
import { getUserProfile, savePlanToUser } from '@/services/userService';
import { useToast } from '@/hooks/use-toast';
import { Plan, Profile, Category, City, SearchedUser, Influencer, PlanCollection } from '@/types/user';
import { useAuth } from '@/context/AuthContext';
import { Loader2, MapPin, Calendar, Star, Search, Users, Heart, Share2, BookmarkPlus, Lock, Percent, Check, X, UserCheck, UserPlus, BadgeCheck, ArrowLeft, Layers, Crown, TrendingUp, Clock, Sparkles, Filter } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { calculateEnhancedPlanScore } from '@/lib/utils/enhancedRanking';
import { useRouter } from 'next/navigation';
import type { UserPreferences, GeoPoint } from '@/types/user';
import { UserSearchResultCard } from './UserSearchResultCard';
import { trackSearch, trackResultClick, getRecentSearches, clearSearchHistory } from '@/services/searchAnalyticsService.client';
import type { PersonalizedRecommendations } from '@/services/recommendationService.admin';

// Profile card for Day in the Life section
const ProfileCard = ({ profile }: { profile: Profile | Influencer }) => {
  const formatDate = (dateString?: string) => { if (!dateString) return ''; try { const date = new Date(dateString); if (isNaN(date.getTime())) return ''; return format(date, 'dd/MM/yyyy'); } catch (error) { return ''; }};
  return (
    <div className="relative flex-shrink-0 w-[120px] h-[120px] bg-card rounded-2xl overflow-hidden">
      <div className="absolute inset-0">
        {profile.avatarUrl || profile.imageUrl ? (<Image src={profile.avatarUrl || profile.imageUrl!} alt={profile.name || 'Profile'} fill className="object-cover" data-ai-hint={profile.type?.toLowerCase() || "profile content"} />)
        : (<div className="w-full h-full flex items-center justify-center bg-muted"><span className="text-2xl font-semibold text-muted-foreground">{profile.name ? profile.name.charAt(0).toUpperCase() : 'P'}</span></div>)}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-2 text-white">
        <h3 className="text-xs font-medium line-clamp-1">{profile.type || 'Person'}</h3>
        {formatDate(profile.date) && (<p className="text-[10px] opacity-90">{formatDate(profile.date)}</p>)}
        {profile.location && (<p className="text-[10px] opacity-90 line-clamp-1">{profile.location}</p>)}
      </div>
    </div>
  );
};

export const CategoryCard = ({ name, isSelected, onClick, iconUrl }: { name: string; isSelected?: boolean; onClick?: (e: React.MouseEvent) => void; iconUrl?: string; }) => (
  <Button variant={isSelected ? "default" : "outline"} className={cn("h-[90px] w-full text-base font-medium rounded-xl relative overflow-hidden", "border border-border/50 bg-card hover:bg-accent/10", isSelected && "border-primary bg-accent/20")}
    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick?.(e); }}>
    <span className="text-base font-medium">{name}</span>
  </Button>
);

// City card component
const CityCard = ({ city, onSelect, isSelected }: { city: City; onSelect: () => void; isSelected: boolean }) => {
  const formatDate = (dateString?: string) => { if (!dateString) return ''; try { const date = new Date(dateString); if (isNaN(date.getTime())) return ''; return format(date, 'dd/MM/yyyy'); } catch (error) { return ''; }};
  return (
    <div className={cn("relative flex-shrink-0 w-[160px] h-[160px] cursor-pointer overflow-hidden rounded-2xl", isSelected && "ring-2 ring-primary")} onClick={onSelect}>
      <div className="absolute inset-0">
        {city.imageUrl ? (<Image src={city.imageUrl} alt={city.name} fill className="object-cover" sizes="160px" data-ai-hint={`${city.name} cityscape`} />)
        : (<div className="absolute inset-0 flex items-center justify-center bg-muted"><MapPin className="h-10 w-10 text-muted-foreground/50" /></div>)}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
        <h3 className="text-base sm:text-lg font-medium line-clamp-1">{city.name}</h3>
        {formatDate(city.date) && (<p className="text-sm opacity-90">{formatDate(city.date)}</p>)}
        {city.location && (<p className="text-sm opacity-90 line-clamp-1">{city.location}</p>)}
      </div>
    </div>
  );
};

// Section component
const Section = ({ title, children, viewAllHref, viewAllText = "View All", className = "" }: { title: string; children: React.ReactNode; viewAllHref?: string; viewAllText?: string; className?: string; }) => (
  <section className="mb-6 w-full">
    <div className="flex justify-between items-center mb-3"><h2 className="text-xl font-semibold">{title}</h2>{viewAllHref && (<Link href={viewAllHref}><Button variant="link" className="text-primary text-sm px-0">{viewAllText}</Button></Link>)}</div>
    <div className={cn("w-full", className)}>{children}</div>
  </section>
);

// Plan card component
const PlanCard = ({ plan }: { plan: Plan }) => {
  const { user } = useAuth(); const { toast } = useToast(); const [saving, setSaving] = useState(false);
  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation(); if (!user) { toast({ title: "Login Required", description: "Please log in to save plans", variant: "destructive"}); return; }
    setSaving(true); try { const success = await savePlanToUser(user.uid, plan.id); if (success) { toast({ title: "Template Saved", description: "Activity template has been added to your saved collection"}); } else { toast({ title: "Error", description: "Failed to save template", variant: "destructive"}); } } catch (error) { console.error('Error saving template:', error); toast({ title: "Error", description: "Failed to save template", variant: "destructive"}); } finally { setSaving(false); }
  };
  const maxDiscount = useMemo(() => { if (!plan.venues?.length) return 0; return Math.max(...plan.venues.map(v => v.discount)); }, [plan.venues]);
  return (
    <Link href={`/p/${plan.id}`}>
      <div className="relative bg-card rounded-xl overflow-hidden border border-border/50 hover:border-border transition-colors">
        {plan.isPremiumOnly && (<div className="absolute top-2 right-2 z-10"><Badge variant="premium" className="bg-gradient-to-r from-amber-500 to-amber-700"><Lock className="h-3 w-3 mr-1" /> Premium</Badge></div>)}
        {maxDiscount > 0 && (<div className="absolute top-2 left-2 z-10"><Badge variant="secondary" className="bg-green-500/90 text-white"><Percent className="h-3 w-3 mr-1" /> Up to {maxDiscount}% off</Badge></div>)}
        <div className="relative aspect-[2/1] bg-muted">{plan.photoHighlights?.[0] ? (<Image src={plan.photoHighlights[0]} alt={plan.name} fill className="object-cover" data-ai-hint={`${plan.eventType} event`} />) : (<div className="absolute inset-0 flex items-center justify-center"><Calendar className="h-8 w-8 text-muted-foreground/50" /></div>)}</div>
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div><h3 className="font-semibold line-clamp-2">{plan.name}</h3>{plan.location && (<p className="text-sm text-muted-foreground flex items-center gap-1 mt-1"><MapPin className="h-3 w-3" /> {plan.location}</p>)}</div>
            {plan.averageRating && (<div className="flex items-center gap-1 text-amber-500"><Star className="h-4 w-4 fill-current" /><span className="text-sm font-medium">{plan.averageRating.toFixed(1)}</span></div>)}
          </div>
          <div className="flex items-center gap-3 mt-3 text-sm text-muted-foreground">
            {plan.participantsCount !== undefined && (<div className="flex items-center gap-1"><Users className="h-4 w-4" /> {plan.participantsCount}</div>)}
            {plan.likesCount !== undefined && (<div className="flex items-center gap-1"><Heart className="h-4 w-4" /> {plan.likesCount}</div>)}
            {plan.sharesCount !== undefined && (<div className="flex items-center gap-1"><Share2 className="h-4 w-4" /> {plan.sharesCount}</div>)}
            {plan.savesCount !== undefined && (<div className="flex items-center gap-1"><BookmarkPlus className="h-4 w-4" /> {plan.savesCount}</div>)}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <Avatar className="h-6 w-6"><AvatarImage src={plan.creatorAvatarUrl} /><AvatarFallback>{plan.creatorName?.[0]?.toUpperCase() || 'U'}</AvatarFallback></Avatar>
            <div className="flex items-center gap-1"><span className="text-sm font-medium">{plan.creatorName}</span>{plan.creatorIsVerified && (<BadgeCheck className="h-4 w-4 text-primary" />)}</div>
          </div>
          <div className="flex items-center gap-2 mt-4"><Button variant="outline" size="sm" className="flex-1" onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><BookmarkPlus className="h-4 w-4 mr-2" /> Save Plan</>}</Button></div>
        </div>
      </div>
    </Link>
  );
};

// Navigation Card component
const NavigationCard = ({ title, description, imageUrl, href, icon: Icon }: { title: string; description: string; imageUrl?: string; href: string; icon: React.ElementType; }) => (
  <Link href={href} onClick={(e) => e.stopPropagation()}>
    <div className="group relative h-[200px] rounded-2xl overflow-hidden bg-black/90">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent">{imageUrl && (<Image src={imageUrl} alt={title} fill className="object-cover transition-transform group-hover:scale-105 mix-blend-overlay opacity-30" data-ai-hint={`${title.toLowerCase()} abstract`} />)}</div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/20" />
      <div className="absolute inset-0 p-6 flex flex-col justify-between">
        <div className="flex items-center gap-3"><div className="p-2.5 rounded-xl bg-white/10 backdrop-blur-sm"><Icon className="h-6 w-6 text-white" /></div></div>
        <div><h3 className="text-lg sm:text-xl font-semibold text-white mb-2">{title}</h3><p className="text-sm text-white/70">{description}</p></div>
      </div>
      <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  </Link>
);

// Featured Plan Panel component
const FeaturedPlanPanel = ({ plan, isAdmin, onRemoveFeature }: { plan: Plan; isAdmin?: boolean; onRemoveFeature?: () => void; }) => {
  const maxDiscount = useMemo(() => { if (!plan.venues?.length) return 0; return Math.max(...plan.venues.map(v => v.discount)); }, [plan.venues]);
  return (
    <Link href={`/p/${plan.id}`}>
      <div className="group relative h-[500px] rounded-2xl overflow-hidden bg-black/90">
        {plan.photoHighlights?.[0] && (<Image src={plan.photoHighlights[0]} alt={plan.name} fill className="object-cover transition-transform group-hover:scale-105 opacity-70" sizes="(max-width: 768px) 100vw, 1000px" priority data-ai-hint={`${plan.eventType} featured`} />)}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
        {isAdmin && onRemoveFeature && (<div className="absolute top-4 right-4 z-10"><Button variant="destructive" size="sm" onClick={(e) => { e.preventDefault(); onRemoveFeature(); }}>Remove Featured</Button></div>)}
        <div className="absolute top-4 left-4 flex flex-col gap-2"><Badge variant="premium" className="bg-gradient-to-r from-amber-500 to-amber-700"><Crown className="h-3 w-3 mr-1" /> Featured</Badge>{plan.isPremiumOnly && (<Badge variant="premium" className="bg-gradient-to-r from-amber-500 to-amber-700"><Lock className="h-3 w-3 mr-1" /> Premium</Badge>)}{maxDiscount > 0 && (<Badge variant="secondary" className="bg-green-500/90 text-white"><Percent className="h-3 w-3 mr-1" /> Up to {maxDiscount}% off</Badge>)}</div>
        <div className="absolute inset-x-0 bottom-0 p-6">
          <div className="max-w-2xl">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">{plan.name}</h2>
            {plan.description && (<p className="text-lg text-white/80 mb-4 line-clamp-2">{plan.description}</p>)}
            {plan.location && (<p className="text-white/90 flex items-center gap-2 mb-4"><MapPin className="h-5 w-5" /> {plan.location}</p>)}
            <div className="flex items-center gap-6 text-white/80">{plan.participantsCount !== undefined && (<div className="flex items-center gap-2"><Users className="h-5 w-5" /> {plan.participantsCount}</div>)}{plan.likesCount !== undefined && (<div className="flex items-center gap-2"><Heart className="h-5 w-5" /> {plan.likesCount}</div>)}{plan.averageRating && (<div className="flex items-center gap-2 text-amber-400"><Star className="h-5 w-5 fill-current" /> <span className="font-medium">{plan.averageRating.toFixed(1)}</span></div>)}</div>
            <div className="flex items-center gap-3 mt-6">
              <Avatar className="h-10 w-10 ring-2 ring-white/20"><AvatarImage src={plan.creatorAvatarUrl} /><AvatarFallback className="bg-primary/20 text-white">{plan.creatorName?.[0]?.toUpperCase() || 'U'}</AvatarFallback></Avatar>
              <div className="flex items-center gap-2"><span className="text-lg font-medium text-white">{plan.creatorName}</span>{plan.creatorIsVerified && (<BadgeCheck className="h-5 w-5 text-blue-400" />)}</div>
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
  navigationCollections: PlanCollection[];
}

interface ExploreContentProps {
  initialData?: ExplorePageData;
  userPreferences?: UserPreferences | null;
}

export function ExploreContent({ initialData, userPreferences }: ExploreContentProps) {
  const { user } = useAuth(); const { toast } = useToast(); const router = useRouter();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true); const [searchTerm, setSearchTerm] = useState('');
  const [userLocation, setUserLocation] = useState<{ city: string; country: string; coordinates?: GeoPoint; } | undefined>();
  const [selectedCity, setSelectedCity] = useState<string | undefined>();
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [viewMode, setViewMode] = useState<'all' | 'cities' | 'categories' | 'creators' | 'dayInLife'>('all');
  const [profiles, setProfiles] = useState<Profile[]>(initialData?.featuredProfiles || []);
  const [plans, setPlans] = useState<Plan[]>(initialData?.completedPlans || []);
  const [cities, setCities] = useState<City[]>(initialData?.featuredCities || []);
  const [categories, setCategories] = useState<Category[]>(initialData?.categories || []);
  const [navigationCollections, setNavigationCollections] = useState<PlanCollection[]>(initialData?.navigationCollections || []);
  const [userSearchResults, setUserSearchResults] = useState<SearchedUser[]>([]);
  const [collectionSearchResults, setCollectionSearchResults] = useState<PlanCollection[]>([]);
  const [filteredPlans, setFilteredPlans] = useState<Plan[]>([]);
  const [featuredPlans, setFeaturedPlans] = useState<Plan[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false); const [locationRequested, setLocationRequested] = useState(false);
  const [isSearchActive, setIsSearchActive] = useState(false); const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [recommendations, setRecommendations] = useState<PersonalizedRecommendations | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [showRecentSearches, setShowRecentSearches] = useState(false);
  const [searchInputFocused, setSearchInputFocused] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const categoryImages: Record<string, string> = { 'ALL': '/images/categories/all.jpg', 'ART': '/images/categories/art.jpg', 'FITNESS': '/images/categories/fitness.jpg' };

  const requestLocation = useCallback(() => { /* ... (kept same) ... */ }, [toast]);
  useEffect(() => { /* ... (kept same for fetching user's saved location) ... */ }, [user?.uid, toast, locationRequested, requestLocation]);

  const processExploreData = useCallback((allPlansData: Plan[], featuredCitiesData: City[], currentLocation?: { city: string; country: string; coordinates?: GeoPoint }) => {
    const scoredPlans = allPlansData.map(plan => ({...plan, score: calculateEnhancedPlanScore(plan, currentLocation?.coordinates || null, userPreferences || undefined)})).sort((a, b) => b.score - a.score);
    setFeaturedPlans(scoredPlans.filter(plan => plan.featured)); setPlans(scoredPlans.filter(plan => !plan.featured));
    const citiesWithScore = featuredCitiesData.map(city => ({...city, score: scoredPlans.filter(p => p.city?.toLowerCase() === city.name?.toLowerCase()).reduce((acc, p) => acc + (p as any).score, 0)})).sort((a, b) => b.score - a.score);
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
        setNavigationCollections(result.data.navigationCollections || []);
      } else { toast({ title: 'Error', description: result.error || 'Failed to fetch explore data', variant: 'destructive' }); }
    } catch (error: any) { toast({ title: 'Error', description: error.message || 'Failed to fetch explore data', variant: 'destructive' }); }
    finally { setLoading(false); }
  }, [userLocation, userPreferences, processExploreData, toast]);

  useEffect(() => {
    if (initialData) {
      setProfiles(initialData.featuredProfiles || []);
      processExploreData(initialData.completedPlans || [], initialData.featuredCities || [], userLocation);
      setCategories(initialData.categories || []);
      setNavigationCollections(initialData.navigationCollections || []);
      setLoading(false);
    } else { fetchData(); }
  }, [initialData, fetchData, processExploreData, userLocation]);

  const performSearch = useCallback(async (term: string) => {
    if (!term.trim()) { 
      setIsSearchActive(false); 
      setUserSearchResults([]); 
      setCollectionSearchResults([]);
      return; 
    }
    setIsSearchActive(true); 
    setSearchLoading(true); 
    setUserSearchResults([]);
    setCollectionSearchResults([]);
    
    let userCount = 0;
    let collectionCount = 0;
    let planCount = 0;
    
    // Search users
    if (user) {
      try {
        const idToken = await user.getIdToken();
        const userResult = await searchUsersAction(term, idToken);
        if (userResult.success && userResult.users) { 
          setUserSearchResults(userResult.users);
          userCount = userResult.users.length;
        } else { 
          setUserSearchResults([]); 
          if (userResult.error) { 
            toast({ title: "User Search Error", description: userResult.error, variant: "destructive" }); 
          }
        }
      } catch (error: any) { 
        setUserSearchResults([]); 
        toast({ title: "User Search Failed", description: error.message || "Could not search for people.", variant: "destructive" }); 
      }
    }
    
    // Search collections
    try {
      const collectionResult = await searchCollectionsAction(term);
      if (collectionResult.success && collectionResult.collections) {
        setCollectionSearchResults(collectionResult.collections);
        collectionCount = collectionResult.collections.length;
      } else {
        setCollectionSearchResults([]);
        if (collectionResult.error) {
          toast({ title: "Collection Search Error", description: collectionResult.error, variant: "destructive" });
        }
      }
    } catch (error: any) {
      setCollectionSearchResults([]);
      toast({ title: "Collection Search Failed", description: error.message || "Could not search for collections.", variant: "destructive" });
    }
    
    // Count plan results from filtered plans
    const termLower = term.toLowerCase().trim();
    const matchingPlans = [...plans, ...featuredPlans].filter(plan =>
      plan.name.toLowerCase().includes(termLower) || 
      (plan.location?.toLowerCase().includes(termLower)) || 
      (plan.city?.toLowerCase().includes(termLower)) ||
      (plan.eventType?.toLowerCase().includes(termLower)) || 
      (plan.description?.toLowerCase().includes(termLower)) || 
      (plan.creatorName?.toLowerCase().includes(termLower)) ||
      (plan.creatorUsername?.toLowerCase().includes(termLower)) || 
      (plan.itinerary?.some(item => item.placeName?.toLowerCase().includes(termLower)))
    );
    planCount = matchingPlans.length;
    
    // Track search analytics
    try {
      await trackSearch(term, {
        people: userCount,
        plans: planCount,
        collections: collectionCount
      });
      
      // Update recent searches
      setRecentSearches(getRecentSearches(10));
    } catch (error) {
      console.warn('Failed to track search analytics:', error);
    }
    
    setSearchLoading(false);
  }, [user, toast, plans, featuredPlans]);

  useEffect(() => {
    if (!plans) return;
    let newFilteredPlans = [...plans, ...featuredPlans];
    if (selectedCategory && selectedCategory !== 'ALL' && !searchTerm) { newFilteredPlans = newFilteredPlans.filter(plan => plan.eventType?.toLowerCase() === selectedCategory.toLowerCase()); }
    if (selectedCity && !searchTerm) { newFilteredPlans = newFilteredPlans.filter(plan => plan.city?.toLowerCase() === selectedCity.toLowerCase()); }
    if (searchTerm) {
      const term = searchTerm.toLowerCase().trim();
      if (term.length > 0) {
        newFilteredPlans = newFilteredPlans.filter(plan =>
          plan.name.toLowerCase().includes(term) || (plan.location?.toLowerCase().includes(term)) || (plan.city?.toLowerCase().includes(term)) ||
          (plan.eventType?.toLowerCase().includes(term)) || (plan.description?.toLowerCase().includes(term)) || (plan.creatorName?.toLowerCase().includes(term)) ||
          (plan.creatorUsername?.toLowerCase().includes(term)) || (plan.itinerary?.some(item => item.placeName?.toLowerCase().includes(term)))
        );
      }
    }
    setFilteredPlans(newFilteredPlans.sort((a,b) => calculateEnhancedPlanScore(b, userLocation?.coordinates || null, userPreferences) - calculateEnhancedPlanScore(a, userLocation?.coordinates || null, userPreferences)));
  }, [plans, featuredPlans, selectedCategory, selectedCity, searchTerm, userLocation, userPreferences]);

  useEffect(() => { /* ... (kept same for admin check) ... */ }, [user]);
  const toggleFeatured = async (planId: string, newFeaturedStatus: boolean) => { /* ... (kept same) ... */ };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value); 
    
    // Immediately set search state based on whether there's a value
    if (!value.trim()) {
      setIsSearchActive(false);
      setUserSearchResults([]);
      setCollectionSearchResults([]);
    }
    
    if (searchTimeoutRef.current) { clearTimeout(searchTimeoutRef.current); }
    searchTimeoutRef.current = setTimeout(() => { performSearch(value); }, 300);
  };

  // Fetch personalized recommendations
  const fetchRecommendations = useCallback(async () => {
    if (!user) return;
    
    setLoadingRecommendations(true);
    try {
      const response = await fetch('/api/recommendations?limit=10');
      if (response.ok) {
        const data = await response.json();
        setRecommendations(data);
      }
    } catch (error) {
      console.warn('Failed to fetch recommendations:', error);
    } finally {
      setLoadingRecommendations(false);
    }
  }, [user]);

  // Load recent searches and recommendations on component mount
  useEffect(() => {
    setRecentSearches(getRecentSearches(10));
    if (user) {
      fetchRecommendations();
    }
  }, [user, fetchRecommendations]);

  // Handle result click tracking
  const handleResultClick = useCallback(async (
    resultType: 'person' | 'plan' | 'collection',
    resultId: string,
    position: number
  ) => {
    if (searchTerm.trim()) {
      try {
        await trackResultClick(searchTerm, resultType, resultId, position);
      } catch (error) {
        console.warn('Failed to track result click:', error);
      }
    }
  }, [searchTerm]);

  if (loading && !initialData) { return <div className="flex justify-center items-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin" /></div>; }

  return (
    <div className="flex flex-col overflow-x-hidden">
      {/* Header with search and filters */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border/30">
        <div className="container mx-auto px-4 py-3">
          {!isMobile && <h2 className="text-lg font-semibold mb-2 text-center">Discover</h2>}
          <div ref={searchContainerRef} className="relative max-w-2xl mx-auto">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground pointer-events-none" />
            <Input 
              type="search" 
              placeholder="Search plans, people, places..." 
              className="pl-8 sm:pl-10 bg-card border-border text-sm h-8 sm:h-9 rounded-lg focus:ring-primary focus:border-primary w-full pr-10" 
              value={searchTerm} 
              onChange={(e) => {
                const value = e.target.value;
                handleSearchChange(value);
                // Show recent searches when typing if there are matches
                if (value.length > 0 && recentSearches.length > 0) {
                  const hasMatches = recentSearches.some(search => 
                    search.toLowerCase().includes(value.toLowerCase())
                  );
                  setShowRecentSearches(hasMatches);
                } else {
                  setShowRecentSearches(false);
                }
              }} 
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  handleSearchChange('');
                  setShowRecentSearches(false);
                }
                if (e.key === 'ArrowDown' && showRecentSearches) {
                  e.preventDefault();
                  // Focus first recent search item
                  const firstItem = searchContainerRef.current?.querySelector('[data-recent-search]') as HTMLElement;
                  firstItem?.focus();
                }
              }}
              onFocus={() => {
                setSearchInputFocused(true);
                if (searchTerm.length > 0 && recentSearches.length > 0) {
                  const hasMatches = recentSearches.some(search => 
                    search.toLowerCase().includes(searchTerm.toLowerCase())
                  );
                  setShowRecentSearches(hasMatches);
                }
              }}
              onBlur={(e) => {
                setSearchInputFocused(false);
                // Only hide if not clicking within the search container
                if (!searchContainerRef.current?.contains(e.relatedTarget as Node)) {
                  setTimeout(() => setShowRecentSearches(false), 150);
                }
              }}
            />
            {searchTerm && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8" 
                onClick={() => {
                  handleSearchChange('');
                  setShowRecentSearches(false);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        {/* Recent Searches Dropdown - Positioned outside sticky header */}
        {showRecentSearches && searchTerm && searchTerm.length > 0 && recentSearches.length > 0 && (
          <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 w-full max-w-2xl mx-auto px-4 z-[100]">
            <div className="bg-background border border-border rounded-xl shadow-lg max-h-60 overflow-y-auto">
              <div className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-muted-foreground">Recent Searches</h4>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      clearSearchHistory();
                      setRecentSearches([]);
                      setShowRecentSearches(false);
                    }}
                  >
                    Clear
                  </Button>
                </div>
                <div className="space-y-1">
                  {recentSearches
                    .filter(search => search.toLowerCase().includes(searchTerm.toLowerCase()))
                    .slice(0, 5) // Limit to 5 suggestions
                    .map((search, index) => (
                    <button
                      key={index}
                      data-recent-search
                      className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-muted/50 transition-colors flex items-center gap-2 focus:bg-muted/50 focus:outline-none"
                      onClick={() => {
                        handleSearchChange(search);
                        setShowRecentSearches(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          const nextItem = e.currentTarget.nextElementSibling as HTMLElement;
                          nextItem?.focus();
                        }
                        if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          const prevItem = e.currentTarget.previousElementSibling as HTMLElement;
                          if (prevItem) {
                            prevItem.focus();
                          } else {
                            // Focus back to input
                            const input = searchContainerRef.current?.querySelector('input');
                            input?.focus();
                          }
                        }
                        if (e.key === 'Enter') {
                          handleSearchChange(search);
                          setShowRecentSearches(false);
                        }
                      }}
                    >
                      <Search className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <span className="truncate">{search}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {!isSearchActive && (
          <div className="container mx-auto px-4">
            <div className="flex gap-2 py-3 overflow-x-auto hide-scrollbar max-w-2xl mx-auto">
              <Button 
                variant={viewMode === 'all' ? 'default' : 'outline'} 
                size="sm" 
                onClick={() => setViewMode('all')} 
                className={cn(
                  "h-8 sm:h-9 px-2 sm:px-3 text-xs sm:text-sm transition-all duration-200 flex-shrink-0",
                  viewMode === 'all'
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-card border-border hover:bg-secondary/50"
                )}
              >
                All
              </Button>
              <Button 
                variant={viewMode === 'cities' ? 'default' : 'outline'} 
                size="sm" 
                onClick={() => {
                   startTransition(() => {
                     router.push('/explore/cities', { scroll: false });
                   });
                 }} 
                className={cn(
                  "h-8 sm:h-9 px-2 sm:px-3 text-xs sm:text-sm transition-all duration-200 flex-shrink-0",
                  viewMode === 'cities'
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-card border-border hover:bg-secondary/50"
                )}
              >
                Cities
              </Button>
              <Button 
                variant={viewMode === 'categories' ? 'default' : 'outline'} 
                size="sm" 
                onClick={() => {
                   startTransition(() => {
                     router.push('/explore/categories', { scroll: false });
                   });
                 }} 
                className={cn(
                  "h-8 sm:h-9 px-2 sm:px-3 text-xs sm:text-sm transition-all duration-200 flex-shrink-0",
                  viewMode === 'categories'
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-card border-border hover:bg-secondary/50"
                )}
              >
                Categories
              </Button>
              <Button 
                variant={viewMode === 'creators' ? 'default' : 'outline'} 
                size="sm" 
                onClick={() => {
                   startTransition(() => {
                     router.push('/explore/creators', { scroll: false });
                   });
                 }} 
                className={cn(
                  "h-8 sm:h-9 px-2 sm:px-3 text-xs sm:text-sm transition-all duration-200 flex-shrink-0",
                  viewMode === 'creators'
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-card border-border hover:bg-secondary/50"
                )}
              >
                Creators
              </Button>
              <Button 
                variant={viewMode === 'dayInLife' ? 'default' : 'outline'} 
                size="sm" 
                onClick={() => setViewMode('dayInLife')} 
                className={cn(
                  "h-8 sm:h-9 px-2 sm:px-3 text-xs sm:text-sm transition-all duration-200 flex-shrink-0",
                  viewMode === 'dayInLife'
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-card border-border hover:bg-secondary/50"
                )}
              >
                Day in Life
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1">
        {isSearchActive ? (
          <div className="container mx-auto px-4 mb-6">
            {searchLoading && (<div className="flex justify-center items-center py-10 min-h-[200px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>)}
            {!searchLoading && filteredPlans.length === 0 && userSearchResults.length === 0 && collectionSearchResults.length === 0 && (<div className="text-center py-8"><p className="text-muted-foreground">No results found for "{searchTerm}"</p></div>)}
            
            {/* Search Results Summary */}
            {!searchLoading && (userSearchResults.length > 0 || filteredPlans.length > 0 || collectionSearchResults.length > 0) && (
              <div className="mb-6">
                <p className="text-sm text-muted-foreground">
                  Found {userSearchResults.length + filteredPlans.length + collectionSearchResults.length} results for "{searchTerm}"
                  {userSearchResults.length > 0 && ` • ${userSearchResults.length} people`}
                  {filteredPlans.length > 0 && ` • ${filteredPlans.length} plans`}
                  {collectionSearchResults.length > 0 && ` • ${collectionSearchResults.length} collections`}
                </p>
              </div>
            )}
            
            {/* Collection Results */}
            {collectionSearchResults.length > 0 && (
              <Section title={`Matching Collections (${collectionSearchResults.length})`} className="mb-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {collectionSearchResults.map(collection => (
                    <Link key={collection.id} href={`/collections/${collection.id}`}>
                      <div className="group relative h-[200px] rounded-2xl overflow-hidden bg-gradient-to-br from-primary/10 to-secondary/10 border border-border/50 hover:border-primary/30 transition-all duration-300">
                        {collection.coverImageUrl && (
                          <Image 
                            src={collection.coverImageUrl} 
                            alt={collection.title} 
                            fill 
                            className="object-cover transition-transform group-hover:scale-105" 
                          />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        <div className="absolute inset-0 p-4 flex flex-col justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="bg-white/10 text-white border-white/20">
                              <Layers className="h-3 w-3 mr-1" />
                              Collection
                            </Badge>
                            {collection.isFeatured && (
                              <Badge variant="premium" className="bg-gradient-to-r from-amber-500 to-amber-700">
                                <Crown className="h-3 w-3 mr-1" />
                                Featured
                              </Badge>
                            )}
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-white mb-2 line-clamp-2">{collection.title}</h3>
                            {collection.description && (
                              <p className="text-sm text-white/80 line-clamp-2 mb-3">{collection.description}</p>
                            )}
                            <div className="flex items-center gap-3 text-white/70">
                              <div className="flex items-center gap-1">
                                <Users className="h-4 w-4" />
                                <span className="text-sm">{collection.planIds?.length || 0} plans</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Avatar className="h-5 w-5">
                                  <AvatarImage src={collection.curatorAvatarUrl || undefined} />
                                  <AvatarFallback className="text-xs">{collection.curatorName?.[0]?.toUpperCase() || 'C'}</AvatarFallback>
                                </Avatar>
                                <span className="text-sm">{collection.curatorName}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </Section>
            )}
            
            {/* User Results */}
            {userSearchResults.length > 0 && (
              <Section title={`Matching People (${userSearchResults.length})`} className="mb-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {userSearchResults.map(userResult => (
                    <UserSearchResultCard key={userResult.uid} userResult={userResult} />
                  ))}
                </div>
              </Section>
            )}
            
            {/* Plan Results */}
            {filteredPlans.length > 0 && (
              <Section title={`Matching Plans (${filteredPlans.length})`} className="mb-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredPlans.map(plan => <PlanCard key={plan.id} plan={plan} />)}
                </div>
              </Section>
            )}
          </div>
        ) : viewMode === 'all' ? (
          <div className="container mx-auto px-4">


            {/* Personalized Recommendations */}
            {user && recommendations && (
              <>
                {recommendations.plans.length > 0 && (
                  <Section title="Recommended for You" className="mb-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {recommendations.plans.slice(0, 8).map((rec, index) => (
                        <div key={rec.id} className="relative group">
                          <div 
                            onClick={() => handleResultClick('plan', rec.id, index)}
                            className="cursor-pointer"
                          >
                            <PlanCard plan={rec.data as Plan} />
                          </div>
                          {rec.reasons.length > 0 && (
                            <div className="mt-2">
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Sparkles className="h-3 w-3" />
                                <span>{rec.reasons[0]}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                {recommendations.trendingPlans.length > 0 && (
                  <Section title="Trending This Week" className="mb-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {recommendations.trendingPlans.slice(0, 4).map((rec, index) => (
                        <div key={rec.id} className="relative group">
                          <div 
                            onClick={() => handleResultClick('plan', rec.id, index)}
                            className="cursor-pointer"
                          >
                            <PlanCard plan={rec.data as Plan} />
                          </div>
                          <div className="mt-2">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <TrendingUp className="h-3 w-3" />
                              <span>Trending</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                {recommendations.collections.length > 0 && (
                  <Section title="Collections You Might Like" className="mb-8">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {recommendations.collections.slice(0, 4).map((rec, index) => (
                        <div 
                          key={rec.id}
                          onClick={() => handleResultClick('collection', rec.id, index)}
                          className="cursor-pointer"
                        >
                          <Link href={`/collections/${rec.id}`}>
                            <div className="group relative h-[200px] rounded-2xl overflow-hidden bg-gradient-to-br from-primary/10 to-secondary/10 border border-border/50 hover:border-primary/30 transition-all duration-300">
                              {(rec.data as any).coverImageUrl && (
                                <Image 
                                  src={(rec.data as any).coverImageUrl} 
                                  alt={(rec.data as any).title} 
                                  fill 
                                  className="object-cover transition-transform group-hover:scale-105" 
                                />
                              )}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                              <div className="absolute inset-0 p-4 flex flex-col justify-between">
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary" className="bg-white/10 text-white border-white/20">
                                    <Layers className="h-3 w-3 mr-1" />
                                    Collection
                                  </Badge>
                                  {rec.reasons.length > 0 && (
                                    <Badge variant="outline" className="bg-white/10 text-white border-white/20 text-xs">
                                      <Sparkles className="h-3 w-3 mr-1" />
                                      {rec.reasons[0]}
                                    </Badge>
                                  )}
                                </div>
                                <div>
                                  <h3 className="text-lg font-semibold text-white mb-2 line-clamp-2">{(rec.data as any).title}</h3>
                                  {(rec.data as any).description && (
                                    <p className="text-sm text-white/80 line-clamp-2 mb-3">{(rec.data as any).description}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </Link>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}
              </>
            )}

            {featuredPlans.length > 0 && (<Section title="Featured Plans" viewAllHref="/plans/featured" className="mb-12"><div className="flex overflow-x-auto gap-4 pb-4 snap-x snap-mandatory hide-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">{featuredPlans.map((plan: Plan) => (<div key={plan.id} className="flex-none w-[calc(100vw-2rem)] sm:w-[500px] md:w-[600px] lg:w-[800px] max-w-[1000px] snap-center"><FeaturedPlanPanel plan={plan} isAdmin={isAdmin} onRemoveFeature={() => toggleFeatured(plan.id, false)} /></div>))}</div></Section>)}
            {isAdmin && (<Section title="Admin: Add to Featured" className="mb-12"><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">{plans.slice(0, 8).map(plan => (<div key={plan.id} className="relative group"><PlanCard plan={plan} /><div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><Button variant="default" onClick={() => toggleFeatured(plan.id, true)}><Crown className="h-4 w-4 mr-2" />Make Featured</Button></div></div>))}</div></Section>)}
            <Section title="Browse Plans" className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">{navigationCollections.map(collection => (<NavigationCard key={collection.id} title={collection.name} description={collection.description || ''} href={collection.href || `/collections/${collection.id}`} icon={collection.icon === 'MapPin' ? MapPin : collection.icon === 'Layers' ? Layers : collection.icon === 'Users' ? Users : collection.icon === 'Star' ? Star : MapPin} />))}</Section>
            {cities.length > 0 && (<Section title="Popular Cities" viewAllHref="/explore/cities"><div className="flex gap-4 pb-4 overflow-x-auto snap-x snap-mandatory hide-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">{cities.slice(0, 8).map(city => (<Link key={city.name} href={`/plans/city/${city.name}`} className="w-[160px] flex-none sm:w-full"><CityCard city={city} onSelect={() => {}} isSelected={false} /></Link>))}</div></Section>)}
            {categories.length > 0 && (<Section title="Popular Categories" viewAllHref="/explore/categories"><div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">{categories.slice(0, 6).map(category => (<Link key={category.name} href={`/plans/category/${encodeURIComponent(category.name)}`}><CategoryCard name={category.name} iconUrl={category.iconUrl} isSelected={false} /></Link>))}</div></Section>)}
            {profiles.length > 0 && (<Section title="A Day in the Life Of" viewAllHref="/explore/creators"><div className="flex gap-4 pb-4 overflow-x-auto snap-x snap-mandatory hide-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-8 xl:grid-cols-10">{profiles.map(profile => (<Link key={profile.id} href={`/users/${profile.id}`} className="w-[140px] flex-none sm:w-full"><ProfileCard profile={profile} /></Link>))}</div></Section>)}
            {filteredPlans.length > 0 && (<Section title="Popular Plans" viewAllHref="/plans" className="space-y-6"><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">{filteredPlans.slice(0, 8).map(plan => (<PlanCard key={plan.id} plan={plan} />))}</div></Section>)}
             {!loading && plans.length === 0 && featuredPlans.length === 0 && !isSearchActive && (<div className="text-center py-12 text-muted-foreground"><Search className="mx-auto h-16 w-16 opacity-30 mb-3" /><p className="font-semibold text-lg">No plans to show right now.</p><p className="text-sm">Try adjusting your location or search terms, or check back later!</p></div>)}
          </div>
        ) : (<div className="container mx-auto px-4"><div className="text-center py-10"><p className="text-muted-foreground">Select a view (All, Cities, Categories, etc.) to see content.</p></div></div>)}
      </div>
    </div>
  );
}
