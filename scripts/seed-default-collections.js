const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');
  const serviceAccount = require(serviceAccountPath);
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id
  });
}

const db = admin.firestore();

// Default collections that should exist to match the navigation cards
const defaultCollections = [
  {
    title: 'Cities',
    description: 'Explore plans by location - discover amazing experiences in cities around the world',
    type: 'curated_by_team',
    curatorName: 'Crossand Team',
    tags: ['cities', 'location', 'travel', 'explore'],
    isFeatured: true,
    coverImageUrl: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&h=600&fit=crop',
    planIds: [], // Will be populated with city-based plans
    isDefault: true,
    navigationCard: true,
    icon: 'MapPin',
    href: '/explore/cities',
    sortOrder: 1
  },
  {
    title: 'Categories',
    description: 'Browse by interest - find plans that match your passions and hobbies',
    type: 'curated_by_team',
    curatorName: 'Crossand Team',
    tags: ['categories', 'interests', 'hobbies', 'activities'],
    isFeatured: true,
    coverImageUrl: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&h=600&fit=crop',
    planIds: [], // Will be populated with category-based plans
    isDefault: true,
    navigationCard: true,
    icon: 'Layers',
    href: '/explore/categories',
    sortOrder: 2
  },
  {
    title: 'Creators',
    description: 'Follow your favorite planners - discover content from top creators and influencers',
    type: 'curated_by_team',
    curatorName: 'Crossand Team',
    tags: ['creators', 'influencers', 'planners', 'follow'],
    isFeatured: true,
    coverImageUrl: 'https://images.unsplash.com/photo-1522075469751-3847ae2c3d1c?w=800&h=600&fit=crop',
    planIds: [], // Will be populated with creator plans
    isDefault: true,
    navigationCard: true,
    icon: 'Users',
    href: '/explore/creators',
    sortOrder: 3
  },
  {
    title: 'Celebrity Plans',
    description: 'Experience a day in their life - exclusive plans from celebrities and public figures',
    type: 'influencer_picks',
    curatorName: 'Celebrity Partners',
    tags: ['celebrity', 'exclusive', 'day-in-life', 'famous'],
    isFeatured: true,
    coverImageUrl: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=800&h=600&fit=crop',
    planIds: [], // Will be populated with celebrity plans
    isDefault: true,
    navigationCard: true,
    icon: 'Star',
    href: '/explore/celebrity',
    sortOrder: 4
  }
];

async function seedDefaultCollections() {
  console.log('Starting to seed default collections...');
  
  try {
    // Check if default collections already exist
    const existingCollections = await db.collection('planCollections')
      .where('isDefault', '==', true)
      .get();
    
    if (!existingCollections.empty) {
      console.log('Default collections already exist. Updating them...');
      
      // Update existing default collections
      const batch = db.batch();
      
      for (const collection of defaultCollections) {
        const existingDoc = existingCollections.docs.find(doc => 
          doc.data().title === collection.title
        );
        
        if (existingDoc) {
          const docRef = db.collection('planCollections').doc(existingDoc.id);
          batch.update(docRef, {
            ...collection,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          console.log(`Updated existing collection: ${collection.title}`);
        } else {
          // Create new collection if it doesn't exist
          const docRef = db.collection('planCollections').doc();
          batch.set(docRef, {
            ...collection,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          console.log(`Created new collection: ${collection.title}`);
        }
      }
      
      await batch.commit();
    } else {
      // Create all default collections
      const batch = db.batch();
      
      for (const collection of defaultCollections) {
        const docRef = db.collection('planCollections').doc();
        batch.set(docRef, {
          ...collection,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`Creating collection: ${collection.title}`);
      }
      
      await batch.commit();
    }
    
    console.log('✅ Default collections seeded successfully!');
    
    // Now populate the collections with relevant plans
    await populateCollectionsWithPlans();
    
  } catch (error) {
    console.error('❌ Error seeding default collections:', error);
    throw error;
  }
}

async function populateCollectionsWithPlans() {
  console.log('Populating collections with relevant plans...');
  
  try {
    // Get all published plans
    const plansSnapshot = await db.collection('plans')
      .where('status', '==', 'published')
      .limit(100)
      .get();
    
    const plans = [];
    plansSnapshot.forEach(doc => {
      plans.push({ id: doc.id, ...doc.data() });
    });
    
    // Get the default collections
    const collectionsSnapshot = await db.collection('planCollections')
      .where('isDefault', '==', true)
      .get();
    
    const batch = db.batch();
    
    collectionsSnapshot.forEach(collectionDoc => {
      const collection = collectionDoc.data();
      let relevantPlanIds = [];
      
      switch (collection.title) {
        case 'Cities':
          // Add plans from popular cities
          relevantPlanIds = plans
            .filter(plan => plan.city && ['New York', 'Los Angeles', 'Chicago', 'Miami', 'San Francisco', 'London', 'Paris', 'Tokyo'].includes(plan.city))
            .slice(0, 20)
            .map(plan => plan.id);
          break;
          
        case 'Categories':
          // Add plans from popular categories
          relevantPlanIds = plans
            .filter(plan => plan.eventType && ['Food & Dining', 'Arts & Culture', 'Outdoor Activities', 'Nightlife', 'Shopping'].includes(plan.eventType))
            .slice(0, 20)
            .map(plan => plan.id);
          break;
          
        case 'Creators':
          // Add plans from verified creators or influencers
          relevantPlanIds = plans
            .filter(plan => plan.creatorVerified || plan.creatorRole === 'influencer')
            .slice(0, 20)
            .map(plan => plan.id);
          break;
          
        case 'Celebrity Plans':
          // Add plans tagged as celebrity or exclusive
          relevantPlanIds = plans
            .filter(plan => 
              plan.tags?.some(tag => ['celebrity', 'exclusive', 'vip', 'famous'].includes(tag.toLowerCase())) ||
              plan.eventType === 'Celebrity Experience'
            )
            .slice(0, 20)
            .map(plan => plan.id);
          break;
      }
      
      if (relevantPlanIds.length > 0) {
        const docRef = db.collection('planCollections').doc(collectionDoc.id);
        batch.update(docRef, {
          planIds: relevantPlanIds,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`Added ${relevantPlanIds.length} plans to ${collection.title}`);
      }
    });
    
    await batch.commit();
    console.log('✅ Collections populated with plans successfully!');
    
  } catch (error) {
    console.error('❌ Error populating collections with plans:', error);
    throw error;
  }
}

// Run the seeding
if (require.main === module) {
  seedDefaultCollections()
    .then(() => {
      console.log('🎉 Seeding completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Seeding failed:', error);
      process.exit(1);
    });
}

module.exports = { seedDefaultCollections };