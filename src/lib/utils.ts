import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateImageHint(eventType?: string | null, planName?: string | null): string {
  const generateHintFromText = (text: string | null | undefined): string[] => {
    if (!text) return [];
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/gi, '') // Remove special characters, keep alphanumeric and spaces
      .trim()
      .split(/\s+/)
      .slice(0, 2);
  };

  let words: string[] = [];
  if (eventType) {
    words = generateHintFromText(eventType);
  }
  
  if (words.length < 2 && planName) {
    const planNameWords = generateHintFromText(planName);
    words = [...words, ...planNameWords].slice(0, 2);
  }
  
  words = words.filter(word => word.length > 0);

  if (words.length > 0) {
    return words.join(" ");
  }
  
  return "event gathering"; // Default fallback
}


export function generateGoogleStaticMapUrl(address?: string | null, city?: string | null, defaultSeed?: string | null): string {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const fallbackSeed = defaultSeed || 'map_generic_placeholder';
  const fallbackImage = `https://picsum.photos/seed/${encodeURIComponent(fallbackSeed)}/600/450`;

  if (!apiKey) {
    console.warn("Google Static Maps API key (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) is missing. Falling back to placeholder image.");
    return fallbackImage;
  }

  let fullAddress = "";
  if (address) fullAddress += address;
  if (city) fullAddress = fullAddress ? `${fullAddress}, ${city}` : city;

  if (!fullAddress.trim()) {
    console.warn("No address provided for Static Map. Falling back to placeholder image.");
    return fallbackImage;
  }
  // Basic Static Map URL
  return `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(fullAddress)}&zoom=15&size=600x450&maptype=roadmap&markers=color:red%7C${encodeURIComponent(fullAddress)}&key=${apiKey}`;
}
