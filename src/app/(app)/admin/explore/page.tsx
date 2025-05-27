'use client';

import { useState } from 'react';
import { Shell } from '@/components/layout/Shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { addFeaturedProfile, addCategory, addFeaturedCity } from '@/app/actions/exploreActions';
import { format } from 'date-fns';

export default function AdminExplorePage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    type: '',
    name: '',
    location: '',
    imageUrl: '',
  });

  // Category form state
  const [categoryName, setCategoryName] = useState('');

  // City form state
  const [cityForm, setCityForm] = useState({
    name: '',
    location: '',
    imageUrl: '',
  });

  const handleAddProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await addFeaturedProfile({
        ...profileForm,
        date: format(new Date(), 'dd/MM/yyyy'),
      });
      
      if (result.success) {
        toast({
          title: 'Success',
          description: 'Profile added successfully',
        });
        setProfileForm({ type: '', name: '', location: '', imageUrl: '' });
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add profile',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await addCategory(categoryName);
      if (result.success) {
        toast({
          title: 'Success',
          description: 'Category added successfully',
        });
        setCategoryName('');
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add category',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddCity = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await addFeaturedCity({
        ...cityForm,
        date: format(new Date(), 'dd/MM/yyyy'),
      });
      
      if (result.success) {
        toast({
          title: 'Success',
          description: 'City added successfully',
        });
        setCityForm({ name: '', location: '', imageUrl: '' });
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add city',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Shell>
      <div className="container max-w-4xl mx-auto py-6 space-y-8">
        <h1 className="text-3xl font-bold mb-8">Manage Explore Page</h1>

        <div className="space-y-6">
          {/* Add Featured Profile */}
          <div className="bg-card p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Add Featured Profile</h2>
            <form onSubmit={handleAddProfile} className="space-y-4">
              <Input
                placeholder="Type (e.g., Athlete, Artist)"
                value={profileForm.type}
                onChange={(e) => setProfileForm({ ...profileForm, type: e.target.value })}
                required
              />
              <Input
                placeholder="Name"
                value={profileForm.name}
                onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                required
              />
              <Input
                placeholder="Location"
                value={profileForm.location}
                onChange={(e) => setProfileForm({ ...profileForm, location: e.target.value })}
                required
              />
              <Input
                placeholder="Image URL"
                value={profileForm.imageUrl}
                onChange={(e) => setProfileForm({ ...profileForm, imageUrl: e.target.value })}
              />
              <Button type="submit" disabled={loading}>
                Add Profile
              </Button>
            </form>
          </div>

          {/* Add Category */}
          <div className="bg-card p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Add Category</h2>
            <form onSubmit={handleAddCategory} className="space-y-4">
              <Input
                placeholder="Category Name"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                required
              />
              <Button type="submit" disabled={loading}>
                Add Category
              </Button>
            </form>
          </div>

          {/* Add Featured City */}
          <div className="bg-card p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Add Featured City</h2>
            <form onSubmit={handleAddCity} className="space-y-4">
              <Input
                placeholder="City Name"
                value={cityForm.name}
                onChange={(e) => setCityForm({ ...cityForm, name: e.target.value })}
                required
              />
              <Input
                placeholder="Location (e.g., California)"
                value={cityForm.location}
                onChange={(e) => setCityForm({ ...cityForm, location: e.target.value })}
                required
              />
              <Input
                placeholder="Image URL"
                value={cityForm.imageUrl}
                onChange={(e) => setCityForm({ ...cityForm, imageUrl: e.target.value })}
              />
              <Button type="submit" disabled={loading}>
                Add City
              </Button>
            </form>
          </div>
        </div>
      </div>
    </Shell>
  );
} 