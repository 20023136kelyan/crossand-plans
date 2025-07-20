// Canonical category list for activity plans
// Fully expanded based on the comprehensive scheme provided

export interface Category {
  id: string;
  name: string;
  parentId?: string; // For subcategories
  description?: string;
  icon?: string;
  subcategories?: Category[];
}

export const canonicalCategories: Category[] = [
  // --- Social Dynamics ---
  {
    id: 'social-intensity',
    name: 'Social Intensity',
    subcategories: [
      { id: 'low-social-energy', name: 'Low Social Energy', description: 'Parallel activities, minimal interaction, small talk optional, minimal eye contact.' },
      { id: 'medium-social-energy', name: 'Medium Social Energy', description: 'Collaborative, shared experiences, light conversation, moderate interaction.' },
      { id: 'high-social-energy', name: 'High Social Energy', description: 'Interactive, conversation-heavy, group dynamics, active participation.' },
    ],
  },
  {
    id: 'group-size',
    name: 'Group Size',
    subcategories: [
      { id: 'solo', name: 'Solo', description: 'Individual with optional others nearby.' },
      { id: 'couple', name: 'Couple/Pairs', description: '2 people.' },
      { id: 'small-group', name: 'Small Group', description: '3-5 people.' },
      { id: 'medium-group', name: 'Medium Group', description: '6-10 people.' },
      { id: 'large-group', name: 'Large Group', description: '10+ people.' },
      { id: 'variable-group', name: 'Variable Group', description: 'Flexible size.' },
    ],
  },
  {
    id: 'social-comfort-zone',
    name: 'Social Comfort Zones',
    subcategories: [
      { id: 'introvert-friendly', name: 'Introvert-Friendly', description: 'Low pressure, quiet environments.' },
      { id: 'anxiety-considerate', name: 'Anxiety-Considerate', description: 'Predictable, safe spaces.' },
      { id: 'beginner-social', name: 'Beginner-Social', description: 'Easy entry, forgiving environment.' },
      { id: 'confidence-building', name: 'Confidence-Building', description: 'Supportive, encouraging.' },
      { id: 'extrovert-oriented', name: 'Extrovert-Oriented', description: 'High energy, stimulating.' },
    ],
  },
  {
    id: 'conversation-style',
    name: 'Conversation Style',
    subcategories: [
      { id: 'activity-focused', name: 'Activity-Focused', description: 'Minimal talking required.' },
      { id: 'structured-discussion', name: 'Structured Discussion', description: 'Guided topics, prompts.' },
      { id: 'free-flowing', name: 'Free-Flowing Conversation', description: 'Natural, organic.' },
      { id: 'deep-sharing', name: 'Deep/Meaningful Sharing', description: 'Personal, intimate.' },
      { id: 'debate', name: 'Debate/Opinion-Based', description: 'Intellectual exchange.' },
      { id: 'storytelling', name: 'Storytelling/Sharing', description: 'Narrative-based.' },
    ],
  },
  {
    id: 'relationship-goal',
    name: 'Relationship Goals',
    subcategories: [
      { id: 'ice-breaking', name: 'Ice-Breaking', description: 'First meetings, new connections.' },
      { id: 'deepening-connections', name: 'Deepening Connections', description: 'Building stronger bonds.' },
      { id: 'maintaining-friendships', name: 'Maintaining Friendships', description: 'Ongoing relationships.' },
      { id: 'professional-networking', name: 'Professional Networking', description: 'Career-focused.' },
      { id: 'romantic', name: 'Romantic', description: 'Dating, couples.' },
      { id: 'family-bonding', name: 'Family Bonding', description: 'Family relationships.' },
      { id: 'community-building', name: 'Community Building', description: 'Neighborhood, local.' },
    ],
  },

  // --- Activity Characteristics ---
  {
    id: 'duration',
    name: 'Duration',
    subcategories: [
      { id: 'quick', name: 'Quick', description: '15-30 minutes.' },
      { id: 'short', name: 'Short', description: '30-60 minutes.' },
      { id: 'medium', name: 'Medium', description: '1-3 hours.' },
      { id: 'long', name: 'Long', description: '3+ hours.' },
      { id: 'multi-day', name: 'Multi-Day', description: 'Spans multiple days.' },
      { id: 'multi-session', name: 'Multi-Session', description: 'Repeated over time.' },
      { id: 'ongoing', name: 'Ongoing', description: 'Continuous, no end date.' },
    ],
  },
  {
    id: 'location',
    name: 'Location',
    subcategories: [
      { id: 'indoor', name: 'Indoor', description: 'Home, venues, museums, gyms, restaurants, libraries, etc.' },
      { id: 'outdoor', name: 'Outdoor', description: 'Nature, parks, beaches, urban spaces, adventure, rooftops, sports fields, gardens.' },
    ],
  },
  {
    id: 'activity-type',
    name: 'Activity Type',
    subcategories: [
      { id: 'physical', name: 'Physical', description: 'Sports, fitness, outdoor, walking, dancing, yoga.' },
      { id: 'creative', name: 'Creative', description: 'Visual arts, performing arts, crafts, photography, writing, music.' },
      { id: 'mental', name: 'Mental', description: 'Puzzles, learning, reading, planning, problem-solving, strategy games.' },
      { id: 'entertainment', name: 'Entertainment', description: 'Live shows, movies, gaming, nightlife, festivals, spectator sports.' },
      { id: 'food-centered', name: 'Food-Centered', description: 'Cooking together, dining, food exploration.' },
      { id: 'cultural', name: 'Cultural', description: 'Museums, cultural events, religious, historical, community, traditional.' },
    ],
  },
  {
    id: 'skill-level',
    name: 'Skill Level Required',
    subcategories: [
      { id: 'beginner', name: 'Beginner', description: 'No prior experience.' },
      { id: 'intermediate', name: 'Intermediate', description: 'Some experience helpful.' },
      { id: 'advanced', name: 'Advanced', description: 'Significant experience required.' },
      { id: 'expert', name: 'Expert', description: 'Professional level.' },
      { id: 'mixed-levels', name: 'Mixed Levels', description: 'Accommodates various skills.' },
    ],
  },

  // --- Practical Considerations ---
  {
    id: 'resources-needed',
    name: 'Resources Needed',
    subcategories: [
      { id: 'no-equipment', name: 'No Equipment', description: 'Just participation.' },
      { id: 'basic-supplies', name: 'Basic Supplies', description: 'Common household items.' },
      { id: 'specialized-equipment', name: 'Specialized Equipment', description: 'Specific tools/gear.' },
      { id: 'technology-required', name: 'Technology Required', description: 'Devices, apps, internet.' },
      { id: 'transportation-needed', name: 'Transportation Needed', description: 'Car, public transit.' },
      { id: 'reservations-required', name: 'Reservations Required', description: 'Advance booking.' },
    ],
  },
  {
    id: 'budget-level',
    name: 'Budget Level',
    subcategories: [
      { id: 'free', name: 'Free', description: 'No cost.' },
      { id: 'budget', name: 'Budget-Conscious', description: 'Under $10 per person.' },
      { id: 'moderate', name: 'Moderate', description: '$10-50 per person.' },
      { id: 'premium', name: 'Premium', description: '$50-100 per person.' },
      { id: 'luxury', name: 'Luxury', description: '$100+ per person.' },
      { id: 'investment', name: 'Investment', description: 'One-time high cost, ongoing value.' },
    ],
  },
  {
    id: 'accessibility',
    name: 'Accessibility',
    subcategories: [
      { id: 'physical-accessibility', name: 'Physical Accessibility', description: 'Wheelchair accessible, limited mobility.' },
      { id: 'sensory-friendly', name: 'Sensory-Friendly', description: 'Low noise, controlled lighting.' },
      { id: 'cognitive-accessibility', name: 'Cognitive Accessibility', description: 'Clear instructions, simple concepts.' },
      { id: 'age-inclusive', name: 'Age-Inclusive', description: 'Suitable for various ages.' },
      { id: 'language-flexible', name: 'Language-Flexible', description: 'Minimal language barriers.' },
    ],
  },

  // --- Dietary & Lifestyle ---
  {
    id: 'food-integration',
    name: 'Food Integration',
    subcategories: [
      { id: 'no-food', name: 'No Food Involved' },
      { id: 'dietary-flexible', name: 'Dietary Flexible', description: 'Vegan/Vegetarian, Gluten-Free, Allergen-Friendly, Kosher/Halal.' },
      { id: 'food-centered', name: 'Food-Centered', description: 'Cooking together, dining, food exploration.' },
      { id: 'drinks-focused', name: 'Drinks-Focused', description: 'Coffee/Tea, Non-Alcoholic, Bar/Brewery, BYOB.' },
    ],
  },
  {
    id: 'lifestyle-considerations',
    name: 'Lifestyle Considerations',
    subcategories: [
      { id: 'health-conscious', name: 'Health-Conscious', description: 'Promotes wellness.' },
      { id: 'eco-friendly', name: 'Eco-Friendly', description: 'Sustainable, environmentally conscious.' },
      { id: 'cultural-sensitivity', name: 'Cultural Sensitivity', description: 'Respectful of diverse backgrounds.' },
      { id: 'family-friendly', name: 'Family-Friendly', description: 'Appropriate for children.' },
      { id: 'pet-friendly', name: 'Pet-Friendly', description: 'Allows pets.' },
      { id: 'seasonal', name: 'Seasonal', description: 'Specific to time of year.' },
    ],
  },

  // --- Emotional & Personal ---
  {
    id: 'mood-purpose',
    name: 'Mood/Purpose',
    subcategories: [
      { id: 'energizing', name: 'Energizing', description: 'Boosts energy, excitement.' },
      { id: 'relaxing', name: 'Relaxing', description: 'Calming, stress-reducing.' },
      { id: 'productive', name: 'Productive', description: 'Accomplishes goals, skills.' },
      { id: 'adventurous', name: 'Adventurous', description: 'Exciting, new experiences.' },
      { id: 'nostalgic', name: 'Nostalgic', description: 'Familiar, comforting.' },
      { id: 'celebratory', name: 'Celebratory', description: 'Special occasions, achievements.' },
      { id: 'therapeutic', name: 'Therapeutic', description: 'Healing, processing.' },
    ],
  },
  {
    id: 'personal-growth',
    name: 'Personal Growth',
    subcategories: [
      { id: 'skill-development', name: 'Skill Development', description: 'Learning new abilities.' },
      { id: 'confidence-building', name: 'Confidence Building', description: 'Overcoming fears.' },
      { id: 'self-discovery', name: 'Self-Discovery', description: 'Exploring interests.' },
      { id: 'mindfulness', name: 'Mindfulness', description: 'Present-moment awareness.' },
      { id: 'challenge-oriented', name: 'Challenge-Oriented', description: 'Pushing boundaries.' },
      { id: 'comfort-zone-expansion', name: 'Comfort Zone Expansion', description: 'Gradual growth.' },
    ],
  },
  {
    id: 'environment-comfort',
    name: 'Environment Comfort',
    subcategories: [
      { id: 'familiar-environments', name: 'Familiar Environments', description: 'Known, comfortable spaces.' },
      { id: 'neutral-spaces', name: 'Neutral Spaces', description: 'Public, non-threatening.' },
      { id: 'new-experiences', name: 'New Experiences', description: 'Exploration, adventure.' },
      { id: 'controlled-environment', name: 'Controlled Environment', description: 'Predictable, safe.' },
      { id: 'stimulating-environment', name: 'Stimulating Environment', description: 'Dynamic, engaging.' },
    ],
  },

  // --- Temporal Factors ---
  {
    id: 'time-of-day',
    name: 'Time of Day',
    subcategories: [
      { id: 'morning', name: 'Morning', description: 'Early day energy.' },
      { id: 'afternoon', name: 'Afternoon', description: 'Mid-day social.' },
      { id: 'evening', name: 'Evening', description: 'Wind-down social.' },
      { id: 'night', name: 'Night', description: 'Late evening activities.' },
      { id: 'flexible', name: 'Flexible', description: 'Any time works.' },
    ],
  },
  {
    id: 'frequency',
    name: 'Frequency',
    subcategories: [
      { id: 'one-time', name: 'One-Time', description: 'Single occurrence.' },
      { id: 'recurring', name: 'Recurring', description: 'Regular schedule.' },
      { id: 'seasonal', name: 'Seasonal', description: 'Specific times of year.' },
      { id: 'spontaneous', name: 'Spontaneous', description: 'Unplanned, impromptu.' },
      { id: 'habitual', name: 'Habitual', description: 'Routine-building.' },
    ],
  },
  {
    id: 'seasonality',
    name: 'Seasonality',
    subcategories: [
      { id: 'spring', name: 'Spring', description: 'Renewal, growth themes.' },
      { id: 'summer', name: 'Summer', description: 'Outdoor, high energy.' },
      { id: 'fall', name: 'Fall', description: 'Cozy, reflective.' },
      { id: 'winter', name: 'Winter', description: 'Indoor, warm social.' },
      { id: 'year-round', name: 'Year-Round', description: 'Season-independent.' },
    ],
  },
]; 