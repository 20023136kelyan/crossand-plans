
// src/app/(app)/collections/[collectionId]/page.tsx
'use server';

import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getCollectionByIdAdmin } from '@/services/exploreService.server'; // Updated import
import { getPlansByIdsAdmin } from '@/services/planService.server'; 
import type { Plan, PlanCollection } from '@/types/user';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PlanCard } from '@/app/(app)/plans/page'; 
import { ChevronLeft, Users, Tag, Palette } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default async function CollectionDetailPage({ params }: { params: { collectionId: string } }) {
  const collectionId = params.collectionId;
  const collection: PlanCollection | null = await getCollectionByIdAdmin(collectionId); // Updated function call

  if (!collection) {
    notFound(); 
  }

  let plansInCollection: Plan[] = [];
  if (collection.planIds && collection.planIds.length > 0) {
    plansInCollection = await getPlansByIdsAdmin(collection.planIds);
  }
  
  const currentUserUid = undefined; 

  return (
    <div className="space-y-8 pb-16">
      <Button variant="outline" asChild className="mb-4">
        <Link href="/explore">
          <ChevronLeft className="mr-2 h-4 w-4" /> Back to Explore
        </Link>
      </Button>

      <header className="mb-8">
        <div className="relative w-full h-48 md:h-64 rounded-lg overflow-hidden shadow-lg mb-4 border border-border/30">
          <Image
            src={collection.coverImageUrl || `https://placehold.co/800x400.png?text=${encodeURIComponent(collection.title.substring(0,20))}`}
            alt={collection.title}
            fill
            style={{ objectFit: 'cover' }}
            data-ai-hint={collection.dataAiHint || 'collection abstract'}
            priority
            unoptimized={!collection.coverImageUrl?.startsWith('http')} 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
          <div className="absolute bottom-0 left-0 p-4 md:p-6">
            <h1 className="text-3xl md:text-4xl font-bold text-white shadow-text">{collection.title}</h1>
          </div>
        </div>
        
        {collection.description && (
          <p className="text-md text-muted-foreground mt-2 max-w-2xl">{collection.description}</p>
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
            <PlanCard key={plan.id} plan={plan} currentUserUid={currentUserUid} /> 
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
