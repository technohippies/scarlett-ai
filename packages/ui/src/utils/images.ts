/**
 * Get a working image URL, using proxy if needed
 */
export function getImageUrl(url: string | undefined, apiUrl: string): string | undefined {
  if (!url) return undefined;
  
  // If it's already a full URL and not a soundcloud URL, return as-is
  if (url.startsWith('http') && !url.includes('sndcdn.com')) {
    return url;
  }
  
  // If it's a soundcloud URL, proxy it through our server
  if (url.includes('sndcdn.com')) {
    // Use our image proxy to avoid CORS and handle failures
    const encodedUrl = encodeURIComponent(url);
    return `${apiUrl}/api/images/proxy/${encodedUrl}`;
  }
  
  // If it's a relative URL, make it absolute
  if (url.startsWith('/')) {
    return `${apiUrl}${url}`;
  }
  
  return url;
}

/**
 * Get image URL with fallback to placeholder
 */
export function getArtworkUrl(song: { artworkUrl?: string }, apiUrl: string): string {
  const imageUrl = getImageUrl(song.artworkUrl, apiUrl);
  return imageUrl || `${apiUrl}/api/images/placeholder.svg`;
}