import type { Friend, UserProfile, Plan, Participant, ItineraryItem } from "@/types";
import { MOCK_USER_ID } from "@/types";

// Helper function to calculate age
function calculateMockAge(birthDateString: string | undefined | null): number | undefined {
  if (!birthDateString) return undefined;
  const birthDate = new Date(birthDateString);
  if (isNaN(birthDate.getTime())) return undefined;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDifference = today.getMonth() - birthDate.getMonth();
  if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age < 0 ? 0 : age;
}

// Helper to generate comprehensive preference list for a user profile
const generateComprehensivePreferences = (profile: UserProfile | null | undefined): string[] => {
  if (!profile) return [];
  const prefs: string[] = [];
  if(profile.allergies) profile.allergies.forEach(a => prefs.push(`Allergic to ${a}`));
  if(profile.dietaryRestrictions) profile.dietaryRestrictions.forEach(d => prefs.push(d));
  if(profile.preferences) profile.preferences.forEach(p => prefs.push(p)); 
  if(profile.favoriteCuisines) profile.favoriteCuisines.forEach(c => prefs.push(`Loves ${c} cuisine`));
  if(profile.physicalLimitations) profile.physicalLimitations.forEach(l => prefs.push(`Physical limitation: ${l}`));
  if(profile.activityTypePreferences) profile.activityTypePreferences.forEach(a => prefs.push(`Enjoys ${a}`));
  if(profile.activityTypeDislikes) profile.activityTypeDislikes.forEach(a => prefs.push(`Dislikes ${a}`));
  if(profile.environmentalSensitivities) profile.environmentalSensitivities.forEach(s => prefs.push(`Sensitive to ${s}`));
  if(profile.socialPreferences) profile.socialPreferences.forEach(s => prefs.push(`Socially prefers: ${s}`));
  if (profile.travelTolerance) prefs.push(`Travel tolerance: ${profile.travelTolerance}`);
  if (profile.budgetFlexibilityNotes) prefs.push(`Budget notes: ${profile.budgetFlexibilityNotes}`);
  return Array.from(new Set(prefs)); 
};

declare global {
  var __PLANPAL_MOCK_DB__: {
    userProfilesDb: Record<string, UserProfile>;
    plansDb: Record<string, Plan>;
    participantsDb: Record<string, Participant[]>;
    MOCK_INVITABLE_FRIENDS_DATA: Friend[];
  };
}

const initializeDb = () => {
  if (!global.__PLANPAL_MOCK_DB__) {
    
    const initialUserProfiles: Record<string, UserProfile> = {
      [MOCK_USER_ID]: { 
        id: MOCK_USER_ID,
        firstName: "Demo",
        lastName: "User",
        email: "demo@planpal.app",
        phoneNumber: "+15551234567",
        birthDate: "1990-07-20T00:00:00.000Z",
        age: undefined, 
        address: {
          street: "123 Main St",
          city: "Anytown",
          state: "CA",
          zipCode: "90210",
          country: "US", 
        },
        avatarUrl: "https://picsum.photos/seed/user_123/200/200",
        allergies: ["Peanuts"],
        dietaryRestrictions: ["Vegetarian"],
        preferences: ["Likes board games", "Prefers outdoor activities"], 
        favoriteCuisines: ["Italian", "Mexican"],
        physicalLimitations: [],
        activityTypePreferences: ["Gaming (Video Games, Board Games)", "Outdoors (Hiking, Parks)"],
        activityTypeDislikes: ["Live Music/Concerts"],
        environmentalSensitivities: ["Noise Sensitivity (Prefers Quiet)"],
        travelTolerance: "Up to 1 hour",
        budgetFlexibilityNotes: "Prefers High-end (40-100 USD) to Luxury (100+ USD) for special experiences.",
        socialPreferences: ["Small groups (2-4 people)", "Prefers familiar people"],
        availability: "Evenings and weekends",
        eventAttendanceScore: 25, 
        levelTitle: "", 
        levelStars: 0,  
      },
      "friend_1": {
        id: "friend_1",
        firstName: "Emily",
        lastName: "Carter",
        email: "emily@example.com",
        phoneNumber: "+15559876543",
        birthDate: "1988-03-10T00:00:00.000Z",
        age: undefined,
        address: {
          street: "456 Oak Ave",
          city: "Otherville",
          state: "NY",
          zipCode: "10001",
          country: "US",
        },
        avatarUrl: "https://picsum.photos/seed/emily/200/200",
        allergies: [],
        dietaryRestrictions: [],
        preferences: ["Loves spicy food", "Enjoys live music"],
        favoriteCuisines: ["Thai", "Indian (General)"],
        physicalLimitations: ["Difficulty with Stairs"],
        activityTypePreferences: ["Live Music/Concerts", "Food & Drink (Restaurants, Bars, Cooking)"],
        activityTypeDislikes: [],
        environmentalSensitivities: [],
        travelTolerance: "Flexible",
        budgetFlexibilityNotes: "Prefers Mid-range (15-40 USD) options.",
        socialPreferences: ["Medium groups (5-8 people)", "Enjoys meeting new people"],
        availability: "Weekends",
        eventAttendanceScore: 75,
        levelTitle: "",
        levelStars: 0,
      },
      "friend_2": {
        id: "friend_2",
        firstName: "Michael B.",
        lastName: "Jordan", 
        email: "michael@example.com",
        phoneNumber: "+15551112222",
        birthDate: "1995-11-02T00:00:00.000Z",
        age: undefined,
         address: {
          street: "789 Pine Ln",
          city: "Villagetown",
          state: "TX",
          zipCode: "75001",
          country: "US",
        },
        avatarUrl: "https://picsum.photos/seed/michael_j/200/200",
        allergies: ["Shellfish"],
        dietaryRestrictions: ["Vegan"],
        preferences: ["Prefers art museums"],
        favoriteCuisines: ["African (Ethiopian)", "Vietnamese"],
        physicalLimitations: [],
        activityTypePreferences: ["Arts & Culture (Museums, Theater)", "Educational (Workshops, Lectures)"],
        activityTypeDislikes: ["Sports (Playing)"],
        environmentalSensitivities: ["Crowd Aversion (Prefers Less Crowded)"],
        travelTolerance: "Local only",
        budgetFlexibilityNotes: "Prefers Budget (0-15 USD) to Mid-range (15-40 USD) options.",
        socialPreferences: ["One-on-one interactions", "Small groups (2-4 people)"],
        availability: "Anytime",
        eventAttendanceScore: 10,
        levelTitle: "",
        levelStars: 0,
      },
      "friend_3": {
        id: "friend_3",
        firstName: "Sarah",
        lastName: "Connor",
        email: "sarah@example.com",
        phoneNumber: "+442079460958", 
        birthDate: "2000-01-25T00:00:00.000Z",
        age: undefined,
        address: {
            street: "101 Future Rd",
            city: "Cyber City",
            state: "CA",
            zipCode: "90000",
            country: "US",
        },
        avatarUrl: "https://picsum.photos/seed/sarah/200/200",
        allergies: [],
        dietaryRestrictions: [],
        preferences: ["Action movies", "Tech enthusiast"],
        favoriteCuisines: ["American (Burgers)", "Japanese (Sushi)"],
        physicalLimitations: [],
        activityTypePreferences: ["Movies/Cinema", "Adventure (Theme Parks)"],
        activityTypeDislikes: ["Relaxation (Spa, Meditation)"],
        environmentalSensitivities: [],
        travelTolerance: "Up to 30 mins",
        budgetFlexibilityNotes: "Prefers Mid-range (15-40 USD) to High-end (40-100 USD) options.",
        socialPreferences: ["Medium groups (5-8 people)"],
        availability: "Weeknights",
        eventAttendanceScore: 120,
        levelTitle: "",
        levelStars: 0,
      },
       "user_456": {
        id: "user_456",
        firstName: "Alice",
        lastName: "Wonderland",
        email: "alice.host@example.com",
        phoneNumber: "+15553334444",
        birthDate: "1985-05-05T00:00:00.000Z",
        age: undefined,
         address: {
            street: "Wonderland Way 1",
            city: "Fantasy City",
            state: "FL",
            zipCode: "33333",
            country: "US",
        },
        avatarUrl: "https://picsum.photos/seed/alice_host/200/200",
        allergies: [],
        dietaryRestrictions: [],
        preferences: ["Tea parties", "Croquet"],
        favoriteCuisines: ["British"],
        physicalLimitations: [],
        activityTypePreferences: ["Social Gatherings (Parties, Meetups)"],
        activityTypeDislikes: [],
        environmentalSensitivities: [],
        travelTolerance: "Local only",
        budgetFlexibilityNotes: "Prefers High-end (40-100 USD) options for quality experiences.",
        socialPreferences: ["Small groups (2-4 people)"],
        availability: "Afternoons",
        eventAttendanceScore: 3,
        levelTitle: "",
        levelStars: 0,
      },
      "user_789": {
        id: "user_789",
        firstName: "Jane",
        lastName: "Doe",
        email: "jane.doe@example.com",
        phoneNumber: "+15557778888",
        birthDate: "1992-09-12T00:00:00.000Z",
        age: undefined,
        address: {
            street: "Mystery Lane 42",
            city: "Incognito Town",
            state: "NV",
            zipCode: "89101",
            country: "US",
        },
        avatarUrl: "https://picsum.photos/seed/user_789/200/200",
        allergies: ["Gluten"],
        dietaryRestrictions: ["Gluten-Free"],
        preferences: ["Reading", "Quiet cafes"],
        favoriteCuisines: ["French", "Italian"],
        physicalLimitations: [],
        activityTypePreferences: ["Relaxation (Spa, Meditation)", "Educational (Workshops, Lectures)"],
        activityTypeDislikes: ["Nightlife (Clubs, Dancing)"],
        environmentalSensitivities: ["Noise Sensitivity (Prefers Quiet)"],
        travelTolerance: "Up to 30 mins",
        budgetFlexibilityNotes: "Prefers Budget (0-15 USD) to Mid-range (15-40 USD) options.",
        socialPreferences: ["One-on-one interactions"],
        availability: "Weekend mornings",
        eventAttendanceScore: 60,
        levelTitle: "",
        levelStars: 0,
      },
    };

    Object.values(initialUserProfiles).forEach(profile => {
        profile.age = calculateMockAge(profile.birthDate);
    });

    const initialPlansDb: Record<string, Plan> = {
      "plan_1": {
        id: "plan_1",
        hostId: MOCK_USER_ID,
        name: "Weekend Hiking Trip",
        description: "Explore the Blue Ridge Mountains and enjoy a scenic hike, followed by a brewery visit.",
        eventTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 
        location: "Blue Ridge Mountains Trailhead", // Main starting point
        city: "Asheville", // Main city
        eventType: "Outdoor Adventure & Social",
        priceRange: "$ (Gas & Snacks, Brewery optional)",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
        itinerary: [
          {
            id: "itin_1_1",
            placeName: "Blue Ridge Parkway Hike - Craggy Gardens",
            address: "Craggy Gardens Visitor Center, Blue Ridge Pkwy, NC",
            city: "Asheville",
            description: "Scenic 3-hour hike with beautiful views. Pack water and snacks.",
            googleMapsImageUrl: `https://picsum.photos/seed/craggyhike/600/338`,
            rating: 4.5,
            reviewCount: 120,
          },
          {
            id: "itin_1_2",
            placeName: "Sierra Nevada Brewing Co.",
            address: "100 Sierra Nevada Way, Fletcher, NC 28732",
            city: "Fletcher",
            description: "Post-hike relaxation with craft beers and food options.",
            googleMapsImageUrl: `https://picsum.photos/seed/sierranevada/600/338`,
            rating: 4.8,
            reviewCount: 3500,
          }
        ]
      },
      "plan_2": {
        id: "plan_2",
        hostId: "user_456", 
        name: "Board Game Night",
        description: "Casual get-together for board games and fun at Alice's place.",
        eventTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), 
        location: "Alice's Residence", // Single location
        city: "Fantasy City",
        eventType: "Social Gathering",
        priceRange: "Free",
        status: "confirmed",
        createdAt: new Date(),
        updatedAt: new Date(),
        itinerary: [ // Single item itinerary
           {
            id: "itin_2_1",
            placeName: "Alice's Residence - Game Night",
            address: "Wonderland Way 1, Fantasy City, FL 33333",
            city: "Fantasy City",
            description: "Bring your favorite board game! Snacks provided.",
            googleMapsImageUrl: `https://picsum.photos/seed/alicegames/600/338`,
            rating: 5,
            reviewCount: 10,
          }
        ]
      },
       "plan_3_no_itinerary": {
        id: "plan_3_no_itinerary",
        hostId: MOCK_USER_ID,
        name: "Quick Coffee Meetup",
        description: "Catch up over coffee at a local cafe.",
        eventTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), 
        location: "Downtown Coffee Roasters",
        city: "Anytown",
        eventType: "Casual Meetup",
        priceRange: "$",
        status: "draft",
        createdAt: new Date(),
        updatedAt: new Date(),
        // No itinerary field, or itinerary: []
      },
    };

    const initialParticipantsDb: Record<string, Participant[]> = {
      "plan_1": [
        { 
          id: "part_1_1", 
          planId: "plan_1", 
          userId: MOCK_USER_ID, 
          name: `${initialUserProfiles[MOCK_USER_ID]?.firstName} ${initialUserProfiles[MOCK_USER_ID]?.lastName}`, 
          confirmationStatus: "confirmed", 
          avatarUrl: initialUserProfiles[MOCK_USER_ID]?.avatarUrl, 
          preferences: generateComprehensivePreferences(initialUserProfiles[MOCK_USER_ID])
        },
        { 
          id: "part_1_2", 
          planId: "plan_1", 
          userId: "user_789", 
          name: `${initialUserProfiles["user_789"]?.firstName} ${initialUserProfiles["user_789"]?.lastName}`, 
          confirmationStatus: "pending", 
          avatarUrl: initialUserProfiles["user_789"]?.avatarUrl,
          preferences: generateComprehensivePreferences(initialUserProfiles["user_789"])
        },
      ],
      "plan_2": [
         { 
           id: "part_2_1", 
           planId: "plan_2", 
           userId: "user_456", 
           name: `${initialUserProfiles["user_456"]?.firstName} ${initialUserProfiles["user_456"]?.lastName}`, 
           confirmationStatus: "confirmed", 
           avatarUrl: initialUserProfiles["user_456"]?.avatarUrl,
           preferences: generateComprehensivePreferences(initialUserProfiles["user_456"])
        },
      ],
      "plan_3_no_itinerary": [
        {
          id: "part_3_1",
          planId: "plan_3_no_itinerary",
          userId: MOCK_USER_ID,
          name: `${initialUserProfiles[MOCK_USER_ID]?.firstName} ${initialUserProfiles[MOCK_USER_ID]?.lastName}`,
          confirmationStatus: "confirmed",
          avatarUrl: initialUserProfiles[MOCK_USER_ID]?.avatarUrl,
          preferences: generateComprehensivePreferences(initialUserProfiles[MOCK_USER_ID])
        }
      ]
    };
    
    const initialMockInvitableFriendsData: Friend[] = [
        { id: 'friend_1', userId: 'friend_1', name: `${initialUserProfiles['friend_1']?.firstName} ${initialUserProfiles['friend_1']?.lastName}`, avatarUrl: initialUserProfiles['friend_1']?.avatarUrl, preferences: generateComprehensivePreferences(initialUserProfiles['friend_1']), status: 'accepted' },
        { id: 'friend_2', userId: 'friend_2', name: `${initialUserProfiles['friend_2']?.firstName} ${initialUserProfiles['friend_2']?.lastName}`, avatarUrl: initialUserProfiles['friend_2']?.avatarUrl, preferences: generateComprehensivePreferences(initialUserProfiles['friend_2']), status: 'accepted' },
        { id: 'friend_3', userId: 'friend_3', name: `${initialUserProfiles['friend_3']?.firstName} ${initialUserProfiles['friend_3']?.lastName}`, avatarUrl: initialUserProfiles['friend_3']?.avatarUrl, preferences: generateComprehensivePreferences(initialUserProfiles['friend_3']), status: 'accepted' },
        { id: 'user_789', userId: 'user_789', name: `${initialUserProfiles['user_789']?.firstName} ${initialUserProfiles['user_789']?.lastName}`, avatarUrl: initialUserProfiles['user_789']?.avatarUrl, preferences: generateComprehensivePreferences(initialUserProfiles['user_789']), status: 'accepted' },
    ];

    global.__PLANPAL_MOCK_DB__ = {
      userProfilesDb: initialUserProfiles,
      plansDb: initialPlansDb,
      participantsDb: initialParticipantsDb,
      MOCK_INVITABLE_FRIENDS_DATA: initialMockInvitableFriendsData,
    };
  }
  return global.__PLANPAL_MOCK_DB__;
};

const mockDb = initializeDb();

export const userProfilesDb = mockDb.userProfilesDb;
export const plansDb = mockDb.plansDb;
export const participantsDb = mockDb.participantsDb;
export const MOCK_INVITABLE_FRIENDS_DATA = mockDb.MOCK_INVITABLE_FRIENDS_DATA;


export function reinitializeMockParticipantPreferences() {
    const db = global.__PLANPAL_MOCK_DB__;
    if (!db) return; 
    for (const planId in db.participantsDb) {
        db.participantsDb[planId].forEach(participant => {
            const userProfile = db.userProfilesDb[participant.userId];
            if (userProfile) {
                participant.preferences = generateComprehensivePreferences(userProfile);
                participant.name = `${userProfile.firstName} ${userProfile.lastName}`;
                participant.avatarUrl = userProfile.avatarUrl;
            }
        });
    }
}

