/**
 * Image Utilities
 * Helper functions for handling image URLs from private S3 bucket
 */

import { BASE_URL } from '@/lib/config';

/**
 * Convert S3 URL to proxy URL for private bucket access
 * @param imageUrl - Original S3 image URL
 * @returns Proxied URL through backend or original URL if invalid
 */
export const getProxiedImageUrl = (imageUrl: string | null | undefined): string => {
  // Return empty string for null/undefined
  if (!imageUrl) {
    return '';
  }

  // If it's already a proxy URL, return as is
  if (imageUrl.includes('/api/menu/images/proxy')) {
    return imageUrl;
  }

  // If it's a relative URL or data URL, return as is
  if (imageUrl.startsWith('/') || imageUrl.startsWith('data:')) {
    return imageUrl;
  }

  // If it's an S3 URL, convert to proxy URL
  if (imageUrl.includes('s3.') || imageUrl.includes('amazonaws.com')) {
    const encodedUrl = encodeURIComponent(imageUrl);
    return `${BASE_URL}/api/menu/images/proxy?url=${encodedUrl}`;
  }

  // For any other URL, try to proxy it
  const encodedUrl = encodeURIComponent(imageUrl);
  return `${BASE_URL}/api/menu/images/proxy?url=${encodedUrl}`;
};

/**
 * Get image URL with fallback to placeholder
 * @param imageUrl - Original image URL
 * @param placeholder - Placeholder image URL (optional)
 * @returns Proxied image URL or placeholder
 */
export const getImageUrlWithFallback = (
  imageUrl: string | null | undefined,
  placeholder: string = '/placeholder.svg'
): string => {
  if (!imageUrl) {
    return placeholder;
  }

  return getProxiedImageUrl(imageUrl);
};

/**
 * Handle image load error by setting fallback
 * @param event - Image error event
 * @param fallbackUrl - Fallback image URL
 */
export const handleImageError = (
  event: React.SyntheticEvent<HTMLImageElement>,
  fallbackUrl: string = '/placeholder.svg'
): void => {
  const img = event.currentTarget;
  
  // Prevent infinite loop if fallback also fails
  if (img.src !== fallbackUrl) {
    img.src = fallbackUrl;
  }
};

/**
 * Preload image to check if it's accessible
 * @param imageUrl - Image URL to preload
 * @returns Promise that resolves when image loads or rejects on error
 */
export const preloadImage = (imageUrl: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = getProxiedImageUrl(imageUrl);
  });
};

/**
 * Get multiple image URLs with proxy
 * @param imageUrls - Array of image URLs
 * @returns Array of proxied image URLs
 */
export const getProxiedImageUrls = (imageUrls: (string | null | undefined)[]): string[] => {
  return imageUrls.map(url => getProxiedImageUrl(url)).filter(url => url !== '');
};
