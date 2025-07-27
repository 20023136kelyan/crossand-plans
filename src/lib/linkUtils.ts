/**
 * Detects URLs in text and returns an array of URLs found
 */
export const detectUrls = (text: string): string[] => {
  if (!text) return [];
  
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.match(urlRegex) || [];
};

/**
 * Extracts domain from URL
 */
export const getDomain = (url: string): string => {
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    return domain;
  } catch (e) {
    return '';
  }
};

/**
 * Checks if a URL is an image
 */
export const isImageUrl = (url: string): boolean => {
  if (!url) return false;
  return /\.(jpg|jpeg|gif|png|webp|svg|bmp)$/i.test(url);
};

/**
 * Checks if a URL is a video
 */
export const isVideoUrl = (url: string): boolean => {
  if (!url) return false;
  return /\.(mp4|webm|ogg|mov|avi|wmv|flv|mkv)$/i.test(url);
};

/**
 * Extracts the first URL from text if it exists
 */
export const getFirstUrl = (text: string): string | null => {
  const urls = detectUrls(text);
  return urls.length > 0 ? urls[0] : null;
};
