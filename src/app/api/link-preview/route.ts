import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  
  if (!url) {
    return NextResponse.json(
      { error: 'URL parameter is required' },
      { status: 400 }
    );
  }

  try {
    // Validate URL
    new URL(url);
    
    // Fetch the URL
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
    }
    
    const html = await response.text();
    
    // Simple HTML parser to extract metadata
    const getMetaTag = (name: string) => {
      const regex = new RegExp(`<meta[^>]*property="${name}"[^>]*content="([^"]*)"`, 'i');
      const match = html.match(regex);
      return match ? match[1] : null;
    };
    
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1] : null;
    
    // Try to get OpenGraph or Twitter card data
    const ogTitle = getMetaTag('og:title') || title;
    const ogDescription = getMetaTag('og:description') || getMetaTag('description');
    const ogImage = getMetaTag('og:image');
    const ogSiteName = getMetaTag('og:site_name');
    
    return NextResponse.json({
      success: true,
      title: ogTitle,
      description: ogDescription,
      image: ogImage,
      siteName: ogSiteName,
      url
    });
    
  } catch (error) {
    console.error('Error fetching URL metadata:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch URL metadata',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
