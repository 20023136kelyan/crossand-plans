import { fetchExplorePageDataAction } from '@/app/actions/exploreActions';
import type { Category } from '@/types/user';
import { CategoriesExploreContent } from './CategoriesExploreContent';

export default async function ExploreCategoriesPage() {
  const result = await fetchExplorePageDataAction();
  const categories = result.success ? result.data?.categories || [] : [];
  
  return <CategoriesExploreContent categories={categories} />;
} 