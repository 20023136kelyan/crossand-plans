# **App Name**: PalPlanAI

## Core Features:

- User Authentication: Allow users to authenticate using email/password, with social login as an option.
- Plan Creation: A multi-field form to create/edit a Plan, designed for optimal mobile usability. Should allow specification of name, description, event date/time, primary location/venue, city, event type, price range, participants, and a dynamic itinerary.
- AI-Powered Assistance: Leverage Google's Gemini model using Genkit, implement AI-powered suggestions for plan names, descriptions, and itinerary items. Includes AI "tool" that calls the Google Places API to get live data.
- Real-Time Status Badges: Display real-time status badges for itinerary items (Open, Closed, Status Unknown) based on live Google Places data.
- Transit Time Calculation: Efficiently calculate transit times between itinerary items using the Google Directions API, allowing users to select travel modes. API calls are reduced to the strict minimum and caching is implemented.
- Social Plan Sharing: Social feed on the home page displaying plans from friends or public posts, including user-added highlights (pictures and media).
- Plan Collection and Sharing: Allow users to add plans to their own collections, try them, and share them with their own highlights.  Friend management system with mobile number lookup in contacts and a messages section (with group message support)
- Friend Management: Complete friend management system with mobile number lookup in contacts
- Messaging: Messages section with group message support

## Style Guidelines:

- Primary color: Saturated blue (#4285F4) to convey trust and stability in planning. Use a slightly transparent version for layered UI elements.
- Background color: Light blue (#E8F0FE), a very lightly saturated variant of the primary to maintain focus on foreground elements. Offer a dark mode option with a dark gray background (#333333).
- Accent color: Vibrant orange (#FF5722) to highlight CTAs and important actions, analogous to blue to create emphasis. Adapt the accent color for dark mode to ensure readability.
- Clean, readable sans-serif font optimized for mobile displays. Consider medium font weights for body text and bold weights for headings. Ensure font colors adapt well to both light and dark modes.
- Use flat, minimalist icons that represent event types, activities, and location markers. Ensure icons are designed to be clearly visible on both light and dark backgrounds.
- Mobile-first responsive design with a bottom navigation menu for primary app sections (Plan Creation, Plan Management, Social Features). Use Shadcn UI components for consistency. Incorporate transparency in UI elements where appropriate (e.g., bottom navigation, card backgrounds) to create a layered effect.
- Subtle transitions and animations for itinerary item changes and AI suggestions, enhancing the user experience without being distracting. Ensure animations are optimized for performance in both light and dark modes.