'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Plus,
  Edit,
  Trash2,
  Image as ImageIcon,
  Search,
  Star,
  Eye,
  EyeOff,
  Upload,
  X,
  Save,
  RefreshCw,
  Grid,
  List,
  Filter,
  Tag,
  MapPin,
  Calendar,
  Users,
} from 'lucide-react';
import type { Plan, PlanCollection, Category, City, PlanCollectionType } from '@/types/user';
import { FileUploadButton } from '@/components/upload/FileUpload';

interface CollectionFormData {
  title: string;
  description: string;
  type: PlanCollectionType;
  curatorName: string;
  tags: string[];
  isFeatured: boolean;
  coverImageUrl: string;
  planIds: string[];
  isDefault: boolean;
  navigationCard: boolean;
  icon: string;
  href: string;
  sortOrder: number;
}

interface CategoryFormData {
  name: string;
  description: string;
  iconUrl: string;
}

interface CityFormData {
  name: string;
  date: string;
  location: string;
  imageUrl: string;
}

interface TeamPlanFormData {
  name: string;
  description: string;
  eventType: string;
  city: string;
  location: string;
  priceRange: string;
  participants: string;
  status: 'draft' | 'published';
  planType: 'single-stop' | 'multi-stop';
  date: string;
  startTime: string;
  endTime: string;
  coverImageUrl: string;
  tags: string[];
  itinerary: Array<{
    time: string;
    activity: string;
    location: string;
    description: string;
    duration: string;
    cost: string;
  }>;
}

export function AdminContentCuration() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [collections, setCollections] = useState<PlanCollection[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlans, setSelectedPlans] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'featured' | 'curated' | 'algorithmic'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Form states
  const [collectionForm, setCollectionForm] = useState<CollectionFormData>({
    title: '',
    description: '',
    type: 'curated_by_team',
    curatorName: 'Crossand Team',
    tags: [],
    isFeatured: false,
    coverImageUrl: '',
    planIds: [],
    isDefault: false,
    navigationCard: false,
    icon: '',
    href: '',
    sortOrder: 0
  });
  
  const [categoryForm, setCategoryForm] = useState<CategoryFormData>({
    name: '',
    description: '',
    iconUrl: ''
  });
  
  const [cityForm, setCityForm] = useState<CityFormData>({
    name: '',
    date: '',
    location: '',
    imageUrl: ''
  });
  
  const [teamPlanForm, setTeamPlanForm] = useState<TeamPlanFormData>({
    name: '',
    description: '',
    eventType: '',
    city: '',
    location: '',
    priceRange: '',
    participants: '',
    status: 'draft',
    planType: 'multi-stop',
    date: '',
    startTime: '',
    endTime: '',
    coverImageUrl: '',
    tags: [],
    itinerary: []
  });
  
  const [editingCollection, setEditingCollection] = useState<PlanCollection | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingCity, setEditingCity] = useState<City | null>(null);
  const [showCollectionDialog, setShowCollectionDialog] = useState(false);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [showCityDialog, setShowCityDialog] = useState(false);
  const [showTeamPlanDialog, setShowTeamPlanDialog] = useState(false);
  const [showPlanSelector, setShowPlanSelector] = useState(false);
  const [currentTag, setCurrentTag] = useState('');
  const [currentTeamPlanTag, setCurrentTeamPlanTag] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    if (!user?.uid) return;
    
    setLoading(true);
    try {
      const token = await user.getIdToken();
      
      // Load collections
      const collectionsResponse = await fetch('/api/admin/content/collections', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (collectionsResponse.ok) {
        const collectionsData = await collectionsResponse.json();
        setCollections(collectionsData.collections || []);
      }
      
      // Load categories
      const categoriesResponse = await fetch('/api/admin/content/categories', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (categoriesResponse.ok) {
        const categoriesData = await categoriesResponse.json();
        setCategories(categoriesData.categories || []);
      }
      
      // Load cities
      const citiesResponse = await fetch('/api/admin/content/cities', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (citiesResponse.ok) {
        const citiesData = await citiesResponse.json();
        setCities(citiesData.cities || []);
      }
      
      // Load published plans
      const plansResponse = await fetch('/api/admin/content/plans', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (plansResponse.ok) {
        const plansData = await plansResponse.json();
        setPlans(plansData.plans || []);
      }
      
    } catch (error) {
      console.error('Error loading content data:', error);
      toast.error('Failed to load content data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCollection = async () => {
    if (!user?.uid || !collectionForm.title.trim()) return;
    
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/content/collections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...collectionForm,
          planIds: selectedPlans
        })
      });
      
      if (response.ok) {
        toast.success('Collection created successfully');
        setShowCollectionDialog(false);
        resetCollectionForm();
        loadData();
      } else {
        throw new Error('Failed to create collection');
      }
    } catch (error) {
      console.error('Error creating collection:', error);
      toast.error('Failed to create collection');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCollection = async () => {
    if (!user?.uid || !editingCollection) return;
    
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/admin/content/collections/${editingCollection.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...collectionForm,
          planIds: selectedPlans
        })
      });
      
      if (response.ok) {
        toast.success('Collection updated successfully');
        setShowCollectionDialog(false);
        setEditingCollection(null);
        resetCollectionForm();
        loadData();
      } else {
        throw new Error('Failed to update collection');
      }
    } catch (error) {
      console.error('Error updating collection:', error);
      toast.error('Failed to update collection');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCollection = async (collectionId: string) => {
    if (!user?.uid) return;
    
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/admin/content/collections/${collectionId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        toast.success('Collection deleted successfully');
        loadData();
      } else {
        throw new Error('Failed to delete collection');
      }
    } catch (error) {
      console.error('Error deleting collection:', error);
      toast.error('Failed to delete collection');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTeamPlan = async () => {
    if (!user?.uid || !teamPlanForm.name.trim()) return;
    
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/content/team-plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(teamPlanForm)
      });
      
      if (response.ok) {
        toast.success('Team plan created successfully');
        setShowTeamPlanDialog(false);
        resetTeamPlanForm();
        loadData();
      } else {
        throw new Error('Failed to create team plan');
      }
    } catch (error) {
      console.error('Error creating team plan:', error);
      toast.error('Failed to create team plan');
    } finally {
      setLoading(false);
    }
  };

  const resetCollectionForm = () => {
    setCollectionForm({
      title: '',
      description: '',
      type: 'curated_by_team',
      curatorName: 'Crossand Team',
      tags: [],
      isFeatured: false,
      coverImageUrl: '',
      planIds: [],
      isDefault: false,
      navigationCard: false,
      icon: '',
      href: '',
      sortOrder: 0
    });
    setSelectedPlans([]);
  };

  const resetTeamPlanForm = () => {
    setTeamPlanForm({
      name: '',
      description: '',
      eventType: '',
      city: '',
      location: '',
      priceRange: '',
      participants: '',
      status: 'draft',
      planType: 'multi-stop',
      date: '',
      startTime: '',
      endTime: '',
      coverImageUrl: '',
      tags: [],
      itinerary: []
    });
  };

  const addTag = () => {
    if (currentTag.trim() && !collectionForm.tags.includes(currentTag.trim())) {
      setCollectionForm(prev => ({
        ...prev,
        tags: [...prev.tags, currentTag.trim()]
      }));
      setCurrentTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setCollectionForm(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const addTeamPlanTag = () => {
    if (currentTeamPlanTag.trim() && !teamPlanForm.tags.includes(currentTeamPlanTag.trim())) {
      setTeamPlanForm(prev => ({
        ...prev,
        tags: [...prev.tags, currentTeamPlanTag.trim()]
      }));
      setCurrentTeamPlanTag('');
    }
  };

  const removeTeamPlanTag = (tagToRemove: string) => {
    setTeamPlanForm(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const addItineraryItem = () => {
    setTeamPlanForm(prev => ({
      ...prev,
      itinerary: [...prev.itinerary, {
        time: '',
        activity: '',
        location: '',
        description: '',
        duration: '',
        cost: ''
      }]
    }));
  };

  const removeItineraryItem = (index: number) => {
    setTeamPlanForm(prev => ({
      ...prev,
      itinerary: prev.itinerary.filter((_, i) => i !== index)
    }));
  };

  const updateItineraryItem = (index: number, field: string, value: string) => {
    setTeamPlanForm(prev => ({
      ...prev,
      itinerary: prev.itinerary.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const filteredCollections = collections.filter(collection => {
    const matchesSearch = collection.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         collection.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === 'all' || 
                         (filterType === 'featured' && collection.isFeatured) ||
                         (filterType === 'curated' && collection.type === 'curated_by_team') ||
                         (filterType === 'algorithmic' && collection.type === 'algorithmic');
    return matchesSearch && matchesFilter;
  });

  const filteredPlans = plans.filter(plan => 
    plan.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    plan.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
    plan.eventType?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Content Curation</h1>
          <p className="text-muted-foreground">
            Manage collections, categories, and curated content for the explore page
          </p>
        </div>
        <Button onClick={loadData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="collections" className="space-y-4">
        <TabsList>
          <TabsTrigger value="collections">Collections</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="cities">Cities</TabsTrigger>
          <TabsTrigger value="team-plans">Team Plans</TabsTrigger>
        </TabsList>

        <TabsContent value="collections" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search collections..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 w-64"
                />
              </div>
              <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Collections</SelectItem>
                  <SelectItem value="featured">Featured</SelectItem>
                  <SelectItem value="curated">Curated</SelectItem>
                  <SelectItem value="algorithmic">Algorithmic</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center border rounded-md">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                >
                  <Grid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <Dialog open={showCollectionDialog} onOpenChange={setShowCollectionDialog}>
              <DialogTrigger asChild>
                <Button onClick={() => {
                  resetCollectionForm();
                  setEditingCollection(null);
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Collection
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingCollection ? 'Edit Collection' : 'Create New Collection'}
                  </DialogTitle>
                  <DialogDescription>
                    Collections organize plans for better discovery and user experience.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Title</Label>
                      <Input
                        id="title"
                        value={collectionForm.title}
                        onChange={(e) => setCollectionForm(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="Collection title"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="type">Type</Label>
                      <Select
                        value={collectionForm.type}
                        onValueChange={(value: PlanCollectionType) => 
                          setCollectionForm(prev => ({ ...prev, type: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="curated_by_team">Curated by Team</SelectItem>
                          <SelectItem value="influencer_picks">Influencer Picks</SelectItem>
                          <SelectItem value="user_playlist">User Playlist</SelectItem>
                          <SelectItem value="algorithmic">Algorithmic</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={collectionForm.description}
                      onChange={(e) => setCollectionForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Collection description"
                      rows={3}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="curator">Curator Name</Label>
                      <Input
                        id="curator"
                        value={collectionForm.curatorName}
                        onChange={(e) => setCollectionForm(prev => ({ ...prev, curatorName: e.target.value }))}
                        placeholder="Curator name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="coverImage">Cover Image</Label>
                      <FileUploadButton
                        onFileSelect={(files) => {
                          if (files.length > 0) {
                            // Create a URL for the uploaded file
                            const fileUrl = URL.createObjectURL(files[0]);
                            setCollectionForm(prev => ({ ...prev, coverImageUrl: fileUrl }));
                          }
                        }}
                        accept="image/*"
                        maxFiles={1}
                        className="w-full"
                      />
                      {collectionForm.coverImageUrl && (
                        <div className="mt-2">
                          <img 
                            src={collectionForm.coverImageUrl} 
                            alt="Cover preview" 
                            className="w-32 h-20 object-cover rounded border"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Tags</Label>
                    <div className="flex items-center space-x-2">
                      <Input
                        value={currentTag}
                        onChange={(e) => setCurrentTag(e.target.value)}
                        placeholder="Add tag"
                        onKeyPress={(e) => e.key === 'Enter' && addTag()}
                      />
                      <Button type="button" onClick={addTag} size="sm">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {collectionForm.tags.map((tag, index) => (
                        <Badge key={index} variant="secondary" className="flex items-center gap-1">
                          {tag}
                          <X 
                            className="h-3 w-3 cursor-pointer" 
                            onClick={() => removeTag(tag)}
                          />
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="featured"
                        checked={collectionForm.isFeatured}
                        onChange={(e) => setCollectionForm(prev => ({ ...prev, isFeatured: e.target.checked }))}
                      />
                      <Label htmlFor="featured">Featured Collection</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="isDefault"
                        checked={collectionForm.isDefault}
                        onChange={(e) => setCollectionForm(prev => ({ ...prev, isDefault: e.target.checked }))}
                      />
                      <Label htmlFor="isDefault">Default Collection</Label>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="navigationCard"
                      checked={collectionForm.navigationCard}
                      onChange={(e) => setCollectionForm(prev => ({ ...prev, navigationCard: e.target.checked }))}
                    />
                    <Label htmlFor="navigationCard">Show as Navigation Card</Label>
                  </div>
                  
                  {collectionForm.navigationCard && (
                    <div className="grid grid-cols-3 gap-4 p-4 border rounded-lg bg-muted/50">
                      <div className="space-y-2">
                        <Label htmlFor="icon">Icon Name</Label>
                        <Input
                          id="icon"
                          value={collectionForm.icon}
                          onChange={(e) => setCollectionForm(prev => ({ ...prev, icon: e.target.value }))}
                          placeholder="MapPin, Users, Star, etc."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="href">Navigation Link</Label>
                        <Input
                          id="href"
                          value={collectionForm.href}
                          onChange={(e) => setCollectionForm(prev => ({ ...prev, href: e.target.value }))}
                          placeholder="/explore/cities"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sortOrder">Sort Order</Label>
                        <Input
                          id="sortOrder"
                          type="number"
                          value={collectionForm.sortOrder}
                          onChange={(e) => setCollectionForm(prev => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))}
                          placeholder="1"
                        />
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Selected Plans ({selectedPlans.length})</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowPlanSelector(true)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Plans
                      </Button>
                    </div>
                    <div className="max-h-32 overflow-y-auto border rounded-md p-2">
                      {selectedPlans.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No plans selected</p>
                      ) : (
                        <div className="space-y-1">
                          {selectedPlans.map(planId => {
                            const plan = plans.find(p => p.id === planId);
                            return plan ? (
                              <div key={planId} className="flex items-center justify-between text-sm">
                                <span>{plan.name}</span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSelectedPlans(prev => prev.filter(id => id !== planId))}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : null;
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCollectionDialog(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={editingCollection ? handleUpdateCollection : handleCreateCollection}
                    disabled={loading || !collectionForm.title.trim()}
                  >
                    {loading ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    {editingCollection ? 'Update' : 'Create'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Collections Grid/List */}
          <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-4'}>
            {filteredCollections.map((collection) => (
              <Card key={collection.id} className={viewMode === 'list' ? 'flex items-center p-4' : ''}>
                {viewMode === 'grid' ? (
                  <>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <CardTitle className="text-lg">{collection.title}</CardTitle>
                          {collection.isFeatured && (
                            <Star className="h-4 w-4 text-yellow-500 fill-current" />
                          )}
                          {collection.isDefault && (
                            <Badge variant="default" className="text-xs bg-blue-500">
                              Default
                            </Badge>
                          )}
                          {collection.navigationCard && (
                            <Badge variant="outline" className="text-xs">
                              Nav Card
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingCollection(collection);
                              setCollectionForm({
                                title: collection.title,
                                description: collection.description || '',
                                type: collection.type,
                                curatorName: collection.curatorName || 'Crossand Team',
                                tags: collection.tags || [],
                                isFeatured: collection.isFeatured || false,
                                coverImageUrl: collection.coverImageUrl || '',
                                planIds: collection.planIds,
                                isDefault: collection.isDefault || false,
                                navigationCard: collection.navigationCard || false,
                                icon: collection.icon || '',
                                href: collection.href || '',
                                sortOrder: collection.sortOrder || 0
                              });
                              setSelectedPlans(collection.planIds);
                              setShowCollectionDialog(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Collection</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{collection.title}"? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteCollection(collection.id)}>
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                      <CardDescription>{collection.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Type:</span>
                          <Badge variant="outline">{collection.type.replace('_', ' ')}</Badge>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Plans:</span>
                          <span>{collection.planIds.length}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Curator:</span>
                          <span>{collection.curatorName}</span>
                        </div>
                        {collection.navigationCard && (
                          <>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Icon:</span>
                              <span>{collection.icon || 'None'}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Link:</span>
                              <span className="truncate max-w-32">{collection.href || 'None'}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Sort Order:</span>
                              <span>{collection.sortOrder || 0}</span>
                            </div>
                          </>
                        )}
                        {collection.tags && collection.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {collection.tags.map((tag, index) => (
                              <Badge key={index} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="font-semibold">{collection.title}</h3>
                          {collection.isFeatured && (
                            <Star className="h-4 w-4 text-yellow-500 fill-current" />
                          )}
                          {collection.isDefault && (
                            <Badge variant="default" className="text-xs bg-blue-500">
                              Default
                            </Badge>
                          )}
                          {collection.navigationCard && (
                            <Badge variant="outline" className="text-xs">
                              Nav Card
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{collection.description}</p>
                        <div className="flex items-center space-x-4 mt-1 text-xs text-muted-foreground">
                          <span>{collection.type.replace('_', ' ')}</span>
                          <span>{collection.planIds.length} plans</span>
                          <span>{collection.curatorName}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingCollection(collection);
                          setCollectionForm({
                            title: collection.title,
                            description: collection.description || '',
                            type: collection.type,
                            curatorName: collection.curatorName || 'Crossand Team',
                            tags: collection.tags || [],
                            isFeatured: collection.isFeatured || false,
                            coverImageUrl: collection.coverImageUrl || '',
                            planIds: collection.planIds
                          });
                          setSelectedPlans(collection.planIds);
                          setShowCollectionDialog(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Collection</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{collection.title}"? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteCollection(collection.id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Activity Categories</h2>
            <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Category
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Category</DialogTitle>
                  <DialogDescription>
                    Create a new activity category for better plan organization.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="categoryName">Category Name</Label>
                    <Input
                      id="categoryName"
                      value={categoryForm.name}
                      onChange={(e) => setCategoryForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Adventure, Food & Drink, Culture"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="categoryDescription">Description</Label>
                    <Textarea
                      id="categoryDescription"
                      value={categoryForm.description}
                      onChange={(e) => setCategoryForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Brief description of this category"
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="categoryIcon">Icon</Label>
                    <FileUploadButton
                      onFileSelect={(files) => {
                        if (files.length > 0) {
                          const fileUrl = URL.createObjectURL(files[0]);
                          setCategoryForm(prev => ({ ...prev, iconUrl: fileUrl }));
                        }
                      }}
                      accept="image/*"
                      maxFiles={1}
                      className="w-full"
                    />
                    {categoryForm.iconUrl && (
                      <div className="mt-2">
                        <img 
                          src={categoryForm.iconUrl} 
                          alt="Icon preview" 
                          className="w-16 h-16 object-cover rounded border"
                        />
                      </div>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCategoryDialog(false)}>
                    Cancel
                  </Button>
                  <Button disabled={!categoryForm.name.trim()}>
                    <Save className="h-4 w-4 mr-2" />
                    Create Category
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((category, index) => (
              <Card key={index}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {category.iconUrl && (
                        <img src={category.iconUrl} alt={category.name} className="h-6 w-6" />
                      )}
                      <CardTitle className="text-lg">{category.name}</CardTitle>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <CardDescription>{category.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="cities" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Featured Cities</h2>
            <Dialog open={showCityDialog} onOpenChange={setShowCityDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add City
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Featured City</DialogTitle>
                  <DialogDescription>
                    Add a city to be featured on the explore page.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="cityName">City Name</Label>
                    <Input
                      id="cityName"
                      value={cityForm.name}
                      onChange={(e) => setCityForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Paris, Tokyo, New York"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cityLocation">Location</Label>
                    <Input
                      id="cityLocation"
                      value={cityForm.location}
                      onChange={(e) => setCityForm(prev => ({ ...prev, location: e.target.value }))}
                      placeholder="Country or region"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cityDate">Featured Date</Label>
                    <Input
                      id="cityDate"
                      type="date"
                      value={cityForm.date}
                      onChange={(e) => setCityForm(prev => ({ ...prev, date: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cityImage">Image</Label>
                    <FileUploadButton
                      onFileSelect={(files) => {
                        if (files.length > 0) {
                          const fileUrl = URL.createObjectURL(files[0]);
                          setCityForm(prev => ({ ...prev, imageUrl: fileUrl }));
                        }
                      }}
                      accept="image/*"
                      maxFiles={1}
                      className="w-full"
                    />
                    {cityForm.imageUrl && (
                      <div className="mt-2">
                        <img 
                          src={cityForm.imageUrl} 
                          alt="City image preview" 
                          className="w-32 h-20 object-cover rounded border"
                        />
                      </div>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCityDialog(false)}>
                    Cancel
                  </Button>
                  <Button disabled={!cityForm.name.trim()}>
                    <Save className="h-4 w-4 mr-2" />
                    Add City
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cities.map((city, index) => (
              <Card key={index}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{city.name}</CardTitle>
                      <CardDescription>{city.location}</CardDescription>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Featured Date:</span>
                      <span>{city.date}</span>
                    </div>
                    {city.imageUrl && (
                      <div className="mt-2">
                        <img 
                          src={city.imageUrl} 
                          alt={city.name} 
                          className="w-full h-32 object-cover rounded-md"
                        />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="team-plans" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Crossand Team Plans</h2>
              <p className="text-sm text-muted-foreground">
                Create high-quality plans authored by the Crossand team
              </p>
            </div>
            <Dialog open={showTeamPlanDialog} onOpenChange={setShowTeamPlanDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Team Plan
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create Team Plan</DialogTitle>
                  <DialogDescription>
                    Create a new plan authored by the Crossand team.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="planName">Plan Name</Label>
                      <Input
                        id="planName"
                        value={teamPlanForm.name}
                        onChange={(e) => setTeamPlanForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Amazing adventure in..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="planEventType">Event Type</Label>
                      <Input
                        id="planEventType"
                        value={teamPlanForm.eventType}
                        onChange={(e) => setTeamPlanForm(prev => ({ ...prev, eventType: e.target.value }))}
                        placeholder="Adventure, Food, Culture..."
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="planDescription">Description</Label>
                    <Textarea
                      id="planDescription"
                      value={teamPlanForm.description}
                      onChange={(e) => setTeamPlanForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Detailed description of the plan"
                      rows={3}
                    />
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="planCity">City</Label>
                      <Input
                        id="planCity"
                        value={teamPlanForm.city}
                        onChange={(e) => setTeamPlanForm(prev => ({ ...prev, city: e.target.value }))}
                        placeholder="Paris, Tokyo..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="planLocation">Location</Label>
                      <Input
                        id="planLocation"
                        value={teamPlanForm.location}
                        onChange={(e) => setTeamPlanForm(prev => ({ ...prev, location: e.target.value }))}
                        placeholder="Specific location"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="planPrice">Price Range</Label>
                      <Input
                        id="planPrice"
                        value={teamPlanForm.priceRange}
                        onChange={(e) => setTeamPlanForm(prev => ({ ...prev, priceRange: e.target.value }))}
                        placeholder="$50-100"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="planParticipants">Participants</Label>
                      <Input
                        id="planParticipants"
                        value={teamPlanForm.participants}
                        onChange={(e) => setTeamPlanForm(prev => ({ ...prev, participants: e.target.value }))}
                        placeholder="2-4 people"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="planType">Plan Type</Label>
                      <Select value={teamPlanForm.planType} onValueChange={(value: 'single-stop' | 'multi-stop') => setTeamPlanForm(prev => ({ ...prev, planType: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="single-stop">Single Stop</SelectItem>
                          <SelectItem value="multi-stop">Multi Stop</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="planStatus">Status</Label>
                      <Select value={teamPlanForm.status} onValueChange={(value: 'draft' | 'published') => setTeamPlanForm(prev => ({ ...prev, status: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="published">Published</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="planDate">Date</Label>
                      <Input
                        id="planDate"
                        type="date"
                        value={teamPlanForm.date}
                        onChange={(e) => setTeamPlanForm(prev => ({ ...prev, date: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="planStartTime">Start Time</Label>
                      <Input
                        id="planStartTime"
                        type="time"
                        value={teamPlanForm.startTime}
                        onChange={(e) => setTeamPlanForm(prev => ({ ...prev, startTime: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="planEndTime">End Time</Label>
                      <Input
                        id="planEndTime"
                        type="time"
                        value={teamPlanForm.endTime}
                        onChange={(e) => setTeamPlanForm(prev => ({ ...prev, endTime: e.target.value }))}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="planCoverImage">Cover Image</Label>
                    <FileUploadButton
                      onFileSelect={(files) => {
                        if (files.length > 0) {
                          const fileUrl = URL.createObjectURL(files[0]);
                          setTeamPlanForm(prev => ({ ...prev, coverImageUrl: fileUrl }));
                        }
                      }}
                      accept="image/*"
                      maxFiles={1}
                      className="w-full"
                    />
                    {teamPlanForm.coverImageUrl && (
                      <div className="mt-2">
                        <img 
                          src={teamPlanForm.coverImageUrl} 
                          alt="Cover preview" 
                          className="w-32 h-20 object-cover rounded border"
                        />
                      </div>
                    )}
                  </div>
                   
                   <div className="space-y-2">
                     <Label>Tags</Label>
                     <div className="flex items-center space-x-2">
                       <Input
                         value={currentTeamPlanTag}
                         onChange={(e) => setCurrentTeamPlanTag(e.target.value)}
                         placeholder="Add tag"
                         onKeyPress={(e) => e.key === 'Enter' && addTeamPlanTag()}
                       />
                       <Button type="button" onClick={addTeamPlanTag} size="sm">
                         <Plus className="h-4 w-4" />
                       </Button>
                     </div>
                     <div className="flex flex-wrap gap-2 mt-2">
                       {teamPlanForm.tags.map((tag, index) => (
                         <Badge key={index} variant="secondary" className="flex items-center gap-1">
                           {tag}
                           <X 
                             className="h-3 w-3 cursor-pointer" 
                             onClick={() => removeTeamPlanTag(tag)}
                           />
                         </Badge>
                       ))}
                     </div>
                   </div>
                   
                   <div className="space-y-2">
                     <div className="flex items-center justify-between">
                       <Label>Itinerary</Label>
                      <Button type="button" onClick={addItineraryItem} size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Item
                      </Button>
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {teamPlanForm.itinerary.map((item, index) => (
                        <div key={index} className="border rounded-md p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Item {index + 1}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeItineraryItem(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              value={item.time}
                              onChange={(e) => updateItineraryItem(index, 'time', e.target.value)}
                              placeholder="Time (e.g., 9:00 AM)"
                            />
                            <Input
                              value={item.activity}
                              onChange={(e) => updateItineraryItem(index, 'activity', e.target.value)}
                              placeholder="Activity name"
                            />
                          </div>
                          <Input
                            value={item.location}
                            onChange={(e) => updateItineraryItem(index, 'location', e.target.value)}
                            placeholder="Location"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              value={item.duration}
                              onChange={(e) => updateItineraryItem(index, 'duration', e.target.value)}
                              placeholder="Duration (e.g., 2 hours)"
                            />
                            <Input
                              value={item.cost}
                              onChange={(e) => updateItineraryItem(index, 'cost', e.target.value)}
                              placeholder="Cost (e.g., $25)"
                            />
                          </div>
                          <Textarea
                            value={item.description}
                            onChange={(e) => updateItineraryItem(index, 'description', e.target.value)}
                            placeholder="Description"
                            rows={2}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowTeamPlanDialog(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleCreateTeamPlan}
                    disabled={loading || !teamPlanForm.name.trim()}
                  >
                    {loading ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Create Plan
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans.filter(plan => plan.creatorName === 'Crossand Team').map((plan) => (
              <Card key={plan.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{plan.name}</CardTitle>
                      <CardDescription>{plan.city} • {plan.eventType}</CardDescription>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Price:</span>
                      <span>{plan.priceRange}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Status:</span>
                      <Badge variant={plan.status === 'published' ? 'default' : 'secondary'}>
                        {plan.status}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Rating:</span>
                      <div className="flex items-center space-x-1">
                        <Star className="h-3 w-3 fill-current text-yellow-500" />
                        <span>{plan.averageRating?.toFixed(1) || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Plan Selector Dialog */}
      <Dialog open={showPlanSelector} onOpenChange={setShowPlanSelector}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select Plans for Collection</DialogTitle>
            <DialogDescription>
              Choose plans to include in this collection. Selected: {selectedPlans.length}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search plans..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <ScrollArea className="h-96">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredPlans.map((plan) => (
                  <div
                    key={plan.id}
                    className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                      selectedPlans.includes(plan.id)
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => {
                      setSelectedPlans(prev => 
                        prev.includes(plan.id)
                          ? prev.filter(id => id !== plan.id)
                          : [...prev, plan.id]
                      );
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium">{plan.name}</h4>
                        <p className="text-sm text-muted-foreground">{plan.description}</p>
                        <div className="flex items-center space-x-4 mt-2 text-xs text-muted-foreground">
                          <div className="flex items-center space-x-1">
                            <MapPin className="h-3 w-3" />
                            <span>{plan.city}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Tag className="h-3 w-3" />
                            <span>{plan.eventType}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Star className="h-3 w-3" />
                            <span>{plan.averageRating?.toFixed(1) || 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="ml-2">
                        {selectedPlans.includes(plan.id) && (
                          <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                            <span className="text-xs text-primary-foreground">✓</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPlanSelector(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowPlanSelector(false)}>
              Done ({selectedPlans.length} selected)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}