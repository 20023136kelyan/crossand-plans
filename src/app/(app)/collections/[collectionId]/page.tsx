// src/app/(app)/collections/[collectionId]/page.tsx
'use server';

import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getCollectionByIdAdmin } from '@/services/exploreService.server';
import { getPlansByIdsAdmin } from '@/services/planService.server';
import type { Plan, PlanCollection } from '@/types/user';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ExploreCard } from '@/components/explore/ExploreCard';
import { ChevronLeft, Users, Tag, Palette } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default async function CollectionDetailPage({ params }: { params: Promise<{ collectionId: string }> }) {
  const { collectionId } = await params;
  const collection: PlanCollection | null = await getCollectionByIdAdmin(collectionId);

  if (!collection) {
    notFound();
  }

  let plansInCollection: Plan[] = [];
  if (collection.planIds && collection.planIds.length > 0) {
    plansInCollection = await getPlansByIdsAdmin(collection.planIds);
  }

  return (
    <div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
      <header className="space-y-3">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/explore" className="text-muted-foreground hover:text-foreground">
              <ChevronLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold text-gradient-primary">{collection.title}</h1>
        </div>

        {collection.description && (
          <p className="text-muted-foreground">{collection.description}</p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
          {collection.curatorName && (
            <div className="flex items-center">
              <Palette className="h-4 w-4 mr-1.5 text-primary" />
              Curated by: <span className="font-medium text-foreground/90 ml-1">{collection.curatorName}</span>
            </div>
          )}
          <div className="flex items-center">
            <Users className="h-4 w-4 mr-1.5 text-primary" />
            {collection.planIds.length} Plan{collection.planIds.length !== 1 ? 's' : ''}
          </div>
          {collection.tags && collection.tags.length > 0 && (
            <div className="flex items-center">
              <Tag className="h-4 w-4 mr-1.5 text-primary" />
              <div className="flex flex-wrap gap-1">
                {collection.tags.map(tag => <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>)}
              </div>
            </div>
          )}
        </div>
      </header>

      {plansInCollection.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {plansInCollection.map(plan => (
            <ExploreCard key={plan.id} plan={plan} />
          ))}
        </div>
      ) : (
        <Card className="col-span-full">
          <CardHeader>
            <CardTitle>No Plans Yet</CardTitle>
            <CardDescription>This collection doesn't have any plans added to it currently.</CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
