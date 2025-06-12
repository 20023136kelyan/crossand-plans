import { fetchExplorePageDataAction } from '@/app/actions/exploreActions';
import type { City } from '@/types/user';
import { CitiesExploreContent } from './CitiesExploreContent';

// Server component for data fetching
export default async function ExploreCitiesPage() {
  const result = await fetchExplorePageDataAction();
  const cities = result.success ? result.data?.featuredCities || [] : [];
  
  return <CitiesExploreContent cities={cities} />;
} 