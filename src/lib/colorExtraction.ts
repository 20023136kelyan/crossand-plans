import ColorThief from 'colorthief';

/**
 * Extract dominant colors from an image and generate a gradient class
 * @param imageUrl - URL of the image to analyze
 * @param fallbackGradient - Fallback gradient if extraction fails
 * @returns Promise<string> - Tailwind gradient class
 */
export async function extractImageGradient(
  imageUrl: string,
  fallbackGradient: string = 'bg-gradient-to-br from-blue-500/40 via-purple-400/25 to-transparent'
): Promise<string> {
  try {
    // For Firebase Storage URLs, skip color extraction due to CORS restrictions
    // and return a smart fallback based on the image name or URL
    if (imageUrl.includes('storage.googleapis.com') || imageUrl.includes('firebasestorage.app')) {
      console.log('Firebase Storage image detected, using smart fallback gradient');
      const smartGradient = getSmartFallbackGradient(imageUrl, fallbackGradient);
      console.log('Smart fallback gradient:', smartGradient);
      return smartGradient;
    }
    
    // Create a new image element
    const img = new Image();
    
    // Try without crossOrigin first for same-origin images
    // Only set crossOrigin for cross-origin images that support it
    if (imageUrl.startsWith('http') && !imageUrl.includes(window.location.hostname)) {
      img.crossOrigin = 'anonymous';
    }
    
    return new Promise((resolve) => {
      img.onload = () => {
        try {
          const colorThief = new ColorThief();
          
          // Get the dominant color and a palette
          const dominantColor = colorThief.getColor(img);
          const palette = colorThief.getPalette(img, 3);
          
          if (!dominantColor || !palette) {
            resolve(fallbackGradient);
            return;
          }
          
          // Convert RGB to HSL to determine color characteristics
          const [r, g, b] = dominantColor;
          const hsl = rgbToHsl(r, g, b);
          const hue = hsl[0];
          const saturation = hsl[1];
          const lightness = hsl[2];
          
          // Generate gradient based on dominant color characteristics
          const gradient = generateGradientFromColor(hue, saturation, lightness, palette);
          resolve(gradient);
        } catch (error) {
          console.warn('Color extraction failed:', error);
          resolve(fallbackGradient);
        }
      };
      
      img.onerror = () => {
        console.warn('Failed to load image for color extraction:', imageUrl);
        // If CORS error, try without crossOrigin
        if (img.crossOrigin) {
          const retryImg = new Image();
          retryImg.onload = () => {
            try {
              const colorThief = new ColorThief();
              const dominantColor = colorThief.getColor(retryImg);
              const palette = colorThief.getPalette(retryImg, 3);
              
              if (!dominantColor || !palette) {
                resolve(getSmartFallbackGradient(imageUrl, fallbackGradient));
                return;
              }
              
              const [r, g, b] = dominantColor;
              const hsl = rgbToHsl(r, g, b);
              const gradient = generateGradientFromColor(hsl[0], hsl[1], hsl[2], palette);
              resolve(gradient);
            } catch (error) {
              console.warn('Color extraction retry failed:', error);
              resolve(getSmartFallbackGradient(imageUrl, fallbackGradient));
            }
          };
          retryImg.onerror = () => resolve(getSmartFallbackGradient(imageUrl, fallbackGradient));
          retryImg.src = imageUrl;
        } else {
          resolve(getSmartFallbackGradient(imageUrl, fallbackGradient));
        }
      };
      
      img.src = imageUrl;
    });
  } catch (error) {
    console.warn('Color extraction error:', error);
    return getSmartFallbackGradient(imageUrl, fallbackGradient);
  }
}

/**
 * Convert RGB to HSL
 */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  
  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

/**
 * Generate a Tailwind gradient class based on color characteristics
 */
function generateGradientFromColor(
  hue: number,
  saturation: number,
  lightness: number,
  palette: number[][]
): string {
  // Determine the base color family based on hue
  let colorFamily = 'gray';
  
  if (hue >= 0 && hue < 15) colorFamily = 'red';
  else if (hue >= 15 && hue < 45) colorFamily = 'orange';
  else if (hue >= 45 && hue < 75) colorFamily = 'yellow';
  else if (hue >= 75 && hue < 105) colorFamily = 'lime';
  else if (hue >= 105 && hue < 135) colorFamily = 'green';
  else if (hue >= 135 && hue < 165) colorFamily = 'emerald';
  else if (hue >= 165 && hue < 195) colorFamily = 'cyan';
  else if (hue >= 195 && hue < 225) colorFamily = 'blue';
  else if (hue >= 225 && hue < 255) colorFamily = 'indigo';
  else if (hue >= 255 && hue < 285) colorFamily = 'purple';
  else if (hue >= 285 && hue < 315) colorFamily = 'fuchsia';
  else if (hue >= 315 && hue < 345) colorFamily = 'pink';
  else if (hue >= 345) colorFamily = 'rose';
  
  // Determine intensity based on saturation and lightness
  let intensity = '400';
  if (saturation > 70 && lightness > 40 && lightness < 70) intensity = '500';
  else if (saturation > 50 && lightness > 30 && lightness < 80) intensity = '400';
  else if (saturation < 30 || lightness > 80) intensity = '300';
  else if (lightness < 30) intensity = '600';
  
  // Get secondary color from palette for more dynamic gradients
  let secondaryColor = colorFamily;
  if (palette.length > 1) {
    const [r2, g2, b2] = palette[1];
    const hsl2 = rgbToHsl(r2, g2, b2);
    const hue2 = hsl2[0];
    
    // Choose a complementary or analogous color
    if (Math.abs(hue - hue2) > 30) {
      if (hue2 >= 0 && hue2 < 15) secondaryColor = 'red';
      else if (hue2 >= 15 && hue2 < 45) secondaryColor = 'orange';
      else if (hue2 >= 45 && hue2 < 75) secondaryColor = 'yellow';
      else if (hue2 >= 75 && hue2 < 105) secondaryColor = 'lime';
      else if (hue2 >= 105 && hue2 < 135) secondaryColor = 'green';
      else if (hue2 >= 135 && hue2 < 165) secondaryColor = 'emerald';
      else if (hue2 >= 165 && hue2 < 195) secondaryColor = 'cyan';
      else if (hue2 >= 195 && hue2 < 225) secondaryColor = 'blue';
      else if (hue2 >= 225 && hue2 < 255) secondaryColor = 'indigo';
      else if (hue2 >= 255 && hue2 < 285) secondaryColor = 'purple';
      else if (hue2 >= 285 && hue2 < 315) secondaryColor = 'fuchsia';
      else if (hue2 >= 315 && hue2 < 345) secondaryColor = 'pink';
      else if (hue2 >= 345) secondaryColor = 'rose';
    }
  }
  
  // Create the gradient with higher opacity for better visibility
  const primaryOpacity = saturation > 50 ? '50' : '40';
  const secondaryOpacity = '30';
  const tertiaryOpacity = '15';
  
  // Add a third color for richer gradients
  let tertiaryColor = 'transparent';
  if (palette.length > 2) {
    const [r3, g3, b3] = palette[2];
    const hsl3 = rgbToHsl(r3, g3, b3);
    const hue3 = hsl3[0];
    
    if (hue3 >= 0 && hue3 < 15) tertiaryColor = 'red-300';
    else if (hue3 >= 15 && hue3 < 45) tertiaryColor = 'orange-300';
    else if (hue3 >= 45 && hue3 < 75) tertiaryColor = 'yellow-300';
    else if (hue3 >= 75 && hue3 < 105) tertiaryColor = 'lime-300';
    else if (hue3 >= 105 && hue3 < 135) tertiaryColor = 'green-300';
    else if (hue3 >= 135 && hue3 < 165) tertiaryColor = 'emerald-300';
    else if (hue3 >= 165 && hue3 < 195) tertiaryColor = 'cyan-300';
    else if (hue3 >= 195 && hue3 < 225) tertiaryColor = 'blue-300';
    else if (hue3 >= 225 && hue3 < 255) tertiaryColor = 'indigo-300';
    else if (hue3 >= 255 && hue3 < 285) tertiaryColor = 'purple-300';
    else if (hue3 >= 285 && hue3 < 315) tertiaryColor = 'fuchsia-300';
    else if (hue3 >= 315 && hue3 < 345) tertiaryColor = 'pink-300';
    else if (hue3 >= 345) tertiaryColor = 'rose-300';
  }
  
  const gradient = tertiaryColor === 'transparent' 
    ? `bg-gradient-to-br from-${colorFamily}-${intensity}/${primaryOpacity} via-${secondaryColor}-${intensity}/${secondaryOpacity} to-transparent`
    : `bg-gradient-to-br from-${colorFamily}-${intensity}/${primaryOpacity} via-${secondaryColor}-${intensity}/${secondaryOpacity} via-${tertiaryColor}/${tertiaryOpacity} to-transparent`;
  
  console.log('Generated gradient from image colors:', gradient);
  return gradient;
}

/**
 * Cache for extracted gradients to avoid re-processing the same images
 */
const gradientCache = new Map<string, string>();

/**
 * Generate a smart fallback gradient based on image URL or context
 */
function getSmartFallbackGradient(imageUrl: string, defaultFallback: string): string {
  // Extract filename from URL
  const filename = imageUrl.split('/').pop()?.toLowerCase() || '';
  
  // Define contextual gradients with multiple complementary hues - increased opacity for better visibility
  const contextualGradients = {
    // Food related - warm, appetizing colors
    food: 'bg-gradient-to-br from-orange-500/50 via-red-400/35 via-amber-300/25 to-yellow-200/15',
    restaurant: 'bg-gradient-to-br from-red-500/50 via-orange-400/35 via-yellow-300/25 to-amber-200/15',
    cafe: 'bg-gradient-to-br from-amber-600/50 via-orange-400/35 via-yellow-300/25 to-orange-200/15',
    coffee: 'bg-gradient-to-br from-amber-700/50 via-orange-500/35 via-yellow-400/25 to-amber-200/15',
    pizza: 'bg-gradient-to-br from-red-500/50 via-orange-400/35 via-yellow-300/25 to-amber-200/15',
    dessert: 'bg-gradient-to-br from-pink-400/50 via-rose-300/35 via-orange-300/25 to-yellow-200/15',
    
    // Nature related - organic, earthy colors
    nature: 'bg-gradient-to-br from-green-500/50 via-emerald-400/35 via-teal-300/25 to-cyan-200/15',
    park: 'bg-gradient-to-br from-green-600/50 via-lime-400/35 via-emerald-300/25 to-teal-200/15',
    beach: 'bg-gradient-to-br from-blue-500/50 via-cyan-400/35 via-teal-300/25 to-emerald-200/15',
    ocean: 'bg-gradient-to-br from-blue-600/50 via-cyan-500/35 via-teal-400/25 to-blue-200/15',
    mountain: 'bg-gradient-to-br from-slate-500/50 via-stone-400/35 via-blue-300/25 to-sky-200/15',
    forest: 'bg-gradient-to-br from-green-700/50 via-emerald-500/35 via-lime-400/25 to-green-200/15',
    sunset: 'bg-gradient-to-br from-orange-600/50 via-red-400/35 via-pink-300/25 to-purple-200/15',
    
    // Urban/City related - modern, sophisticated colors
    city: 'bg-gradient-to-br from-slate-600/50 via-gray-500/35 via-blue-400/25 to-indigo-200/15',
    building: 'bg-gradient-to-br from-gray-600/50 via-slate-500/35 via-blue-400/25 to-sky-200/15',
    street: 'bg-gradient-to-br from-stone-500/50 via-gray-400/35 via-slate-300/25 to-blue-200/15',
    skyline: 'bg-gradient-to-br from-indigo-600/50 via-blue-500/35 via-purple-400/25 to-pink-200/15',
    
    // Entertainment related - vibrant, energetic colors
    event: 'bg-gradient-to-br from-purple-600/50 via-pink-500/35 via-rose-400/25 to-orange-200/15',
    party: 'bg-gradient-to-br from-fuchsia-600/50 via-purple-500/35 via-pink-400/25 to-rose-200/15',
    concert: 'bg-gradient-to-br from-purple-700/50 via-indigo-600/35 via-blue-500/25 to-cyan-200/15',
    festival: 'bg-gradient-to-br from-violet-600/50 via-purple-500/35 via-pink-400/25 to-orange-200/15',
    nightlife: 'bg-gradient-to-br from-indigo-700/50 via-purple-600/35 via-pink-500/25 to-rose-200/15',
    
    // Shopping related - trendy, commercial colors
    shop: 'bg-gradient-to-br from-pink-500/50 via-rose-400/35 via-orange-300/25 to-yellow-200/15',
    mall: 'bg-gradient-to-br from-rose-500/50 via-pink-400/35 via-purple-300/25 to-indigo-200/15',
    market: 'bg-gradient-to-br from-green-600/50 via-lime-500/35 via-yellow-400/25 to-orange-200/15',
    boutique: 'bg-gradient-to-br from-purple-500/50 via-pink-400/35 via-rose-300/25 to-orange-200/15',
    
    // Activity related - dynamic, action colors
    sport: 'bg-gradient-to-br from-blue-600/50 via-cyan-500/35 via-green-400/25 to-lime-200/15',
    gym: 'bg-gradient-to-br from-red-600/50 via-orange-500/35 via-yellow-400/25 to-lime-200/15',
    adventure: 'bg-gradient-to-br from-orange-600/50 via-red-500/35 via-pink-400/25 to-purple-200/15',
    travel: 'bg-gradient-to-br from-blue-600/50 via-indigo-500/35 via-purple-400/25 to-pink-200/15'
  };
  
  // Check for keywords in filename
  for (const [keyword, gradient] of Object.entries(contextualGradients)) {
    if (filename.includes(keyword)) {
      return gradient;
    }
  }
  
  // Check URL path for context
  const urlLower = imageUrl.toLowerCase();
  for (const [keyword, gradient] of Object.entries(contextualGradients)) {
    if (urlLower.includes(keyword)) {
      return gradient;
    }
  }
  
  // Generate a gradient based on URL hash for consistency
  const hash = imageUrl.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  
  const colors = [
    'bg-gradient-to-br from-blue-600/50 via-indigo-500/35 via-purple-400/25 to-pink-200/15',
    'bg-gradient-to-br from-green-600/50 via-emerald-500/35 via-teal-400/25 to-cyan-200/15',
    'bg-gradient-to-br from-orange-600/50 via-red-500/35 via-pink-400/25 to-rose-200/15',
    'bg-gradient-to-br from-purple-600/50 via-violet-500/35 via-fuchsia-400/25 to-pink-200/15',
    'bg-gradient-to-br from-teal-600/50 via-cyan-500/35 via-blue-400/25 to-indigo-200/15',
    'bg-gradient-to-br from-rose-600/50 via-pink-500/35 via-orange-400/25 to-yellow-200/15',
    'bg-gradient-to-br from-indigo-600/50 via-blue-500/35 via-cyan-400/25 to-teal-200/15',
    'bg-gradient-to-br from-amber-600/50 via-orange-500/35 via-red-400/25 to-pink-200/15'
  ];
  
  return colors[Math.abs(hash) % colors.length] || defaultFallback;
}

/**
 * Extract gradient with caching
 */
export async function extractImageGradientCached(
  imageUrl: string,
  fallbackGradient?: string
): Promise<string> {
  if (gradientCache.has(imageUrl)) {
    return gradientCache.get(imageUrl)!;
  }
  
  const gradient = await extractImageGradient(imageUrl, fallbackGradient);
  gradientCache.set(imageUrl, gradient);
  
  return gradient;
}

/**
 * Clear the gradient cache (useful for memory management)
 */
export function clearGradientCache(): void {
  gradientCache.clear();
}