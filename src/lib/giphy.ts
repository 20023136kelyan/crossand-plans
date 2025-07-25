// GIPHY API configuration
export const GIPHY_API_KEY = process.env.NEXT_PUBLIC_GIPHY_API_KEY || '';

export interface GifObject {
  id: string;
  url: string;
  title: string;
  images: {
    original: {
      url: string;
      width: string;
      height: string;
      size: string;
    };
    fixed_width: {
      url: string;
      width: string;
      height: string;
      size: string;
    };
  };
}

export async function searchGifs(query: string, limit: number = 25): Promise<GifObject[]> {
  if (!GIPHY_API_KEY) {
    console.warn('GIPHY API key is not configured');
    return [];
  }

  try {
    const response = await fetch(
      `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=${limit}&offset=0&rating=g&lang=en`
    );
    
    if (!response.ok) {
      throw new Error(`GIPHY API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.data.map((gif: any) => ({
      id: gif.id,
      url: gif.url,
      title: gif.title,
      images: {
        original: gif.images.original,
        fixed_width: gif.images.fixed_width
      }
    }));
  } catch (error) {
    console.error('Error searching GIFs:', error);
    return [];
  }
}

export async function getTrendingGifs(limit: number = 25): Promise<GifObject[]> {
  if (!GIPHY_API_KEY) {
    console.warn('GIPHY API key is not configured');
    return [];
  }

  try {
    const response = await fetch(
      `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=${limit}&rating=g`
    );
    
    if (!response.ok) {
      throw new Error(`GIPHY API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.data.map((gif: any) => ({
      id: gif.id,
      url: gif.url,
      title: gif.title,
      images: {
        original: gif.images.original,
        fixed_width: gif.images.fixed_width
      }
    }));
  } catch (error) {
    console.error('Error fetching trending GIFs:', error);
    return [];
  }
}
