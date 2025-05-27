import { ExploreContent } from '@/components/explore/ExploreContent';
import { fetchExplorePageDataAction } from '@/app/actions/exploreActions';
import { getUserPreferencesAction } from '@/app/actions/userActions';
import { auth } from '@/lib/auth';

export default async function ExplorePage() {
  const session = await auth();
  const userId = session?.user?.id;

  // Fetch user preferences if logged in
  const userPreferences = userId ? await getUserPreferencesAction(userId) : null;
  
  // Fetch explore page data with user preferences
  const result = await fetchExplorePageDataAction(
    undefined, // location will be handled client-side
    Boolean(session?.user?.isPremium),
    session?.user?.activityScore || 0,
    userPreferences
  );

  return <ExploreContent initialData={result.data} userPreferences={userPreferences} />;
} 