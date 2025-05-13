import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!query) {
    return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
  }

  if (!apiKey) {
    return NextResponse.json({ error: 'Google Maps API key is not configured' }, { status: 500 });
  }

  try {
    // First, search for the place
    const searchResponse = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`
    );
    
    if (!searchResponse.ok) {
      const errorData = await searchResponse.json();
      console.error('Error from Google Places API:', errorData);
      return NextResponse.json({ 
        error: 'Failed to fetch from Google Places API', 
        details: errorData,
        businessStatus: 'UNKNOWN',
        status: 'UNKNOWN',
        city: query.split(' ').pop() || '',
        formattedAddress: query
      }, { status: 200 }); // Return 200 with fallback data instead of error status
    }

    const searchData = await searchResponse.json();
    
    if (!searchData.results?.[0]) {
      return NextResponse.json({ 
        error: 'No results found',
        businessStatus: 'UNKNOWN',
        status: 'UNKNOWN',
        city: query.split(' ').pop() || '',
        formattedAddress: query
      }, { status: 200 });
    }

    const place = searchData.results[0];
    
    try {
      // Then get detailed place information with all necessary fields
      const detailsResponse = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=formatted_address,geometry,formatted_phone_number,website,rating,user_ratings_total,price_level,types,opening_hours/open_now,opening_hours/periods,opening_hours/weekday_text,business_status,url,address_components&key=${apiKey}`
      );

      if (!detailsResponse.ok) {
        console.error('Error fetching place details:', await detailsResponse.text());
        // Return basic information from the search result if details fetch fails
        return NextResponse.json({
          placeId: place.place_id,
          formattedAddress: place.formatted_address || query,
          location: place.geometry?.location || { lat: 0, lng: 0 },
          businessStatus: place.business_status?.toUpperCase() || 'UNKNOWN',
          status: place.business_status?.toUpperCase() || 'UNKNOWN',
          city: query.split(' ').pop() || '',
          types: place.types || []
        }, { status: 200 });
      }

      const detailsData = await detailsResponse.json();
      const details = detailsData.result;

      // Extract city from address components with fallback
      const cityComponent = details.address_components?.find(
        (component: { types: string[] }) => 
          component.types.includes("locality") || 
          component.types.includes("administrative_area_level_1")
      );
      const extractedCity = cityComponent?.long_name || query.split(' ').pop() || '';

      // Map business_status to our expected format with proper fallback
      let businessStatus = details.business_status?.toUpperCase() || 'UNKNOWN';
      switch (businessStatus) {
        case 'OPERATIONAL':
        case 'CLOSED_TEMPORARILY':
        case 'CLOSED_PERMANENTLY':
          break;
        default:
          businessStatus = 'UNKNOWN';
      }

      // Return the formatted response with all necessary information
      return NextResponse.json({
        placeId: place.place_id,
        formattedAddress: details.formatted_address || place.formatted_address || query,
        location: {
          lat: details.geometry?.location?.lat || place.geometry?.location?.lat || 0,
          lng: details.geometry?.location?.lng || place.geometry?.location?.lng || 0
        },
        formattedPhoneNumber: details.formatted_phone_number,
        website: details.website,
        rating: details.rating,
        userRatingsTotal: details.user_ratings_total,
        priceLevel: details.price_level,
        types: details.types || place.types || [],
        openingHours: {
          open_now: details.opening_hours?.open_now,
          periods: details.opening_hours?.periods || [],
          weekday_text: details.opening_hours?.weekday_text || []
        },
        businessStatus: businessStatus,
        status: businessStatus,
        url: details.url,
        city: extractedCity
      }, { status: 200 });
    } catch (detailsError) {
      console.error('Error fetching place details:', detailsError);
      // Return basic information from the search result if details fetch fails
      return NextResponse.json({
        placeId: place.place_id,
        formattedAddress: place.formatted_address || query,
        location: place.geometry?.location || { lat: 0, lng: 0 },
        businessStatus: place.business_status?.toUpperCase() || 'UNKNOWN',
        status: place.business_status?.toUpperCase() || 'UNKNOWN',
        city: query.split(' ').pop() || '',
        types: place.types || []
      }, { status: 200 });
    }
  } catch (error) {
    console.error('Error fetching place details:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch place details',
      businessStatus: 'UNKNOWN',
      status: 'UNKNOWN',
      city: query.split(' ').pop() || '',
      formattedAddress: query
    }, { status: 200 }); // Return 200 with fallback data instead of error status
  }
} 