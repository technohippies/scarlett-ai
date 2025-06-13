import { Hono } from 'hono';
import type { Env } from '../types';
import { ArtworkService } from '../services/artwork.service';

const app = new Hono<{ Bindings: Env }>();

// Proxy endpoint for images
app.get('/proxy', async (c) => {
  const imageUrl = c.req.query('url');
  const trackId = c.req.query('trackId'); // Optional track ID for fetching fresh artwork
  
  console.log('[Image Proxy] Image URL:', imageUrl, 'Track ID:', trackId);
  
  if (!imageUrl) {
    return c.text('No URL provided', 400);
  }
  
  try {
    
    console.log('[Image Proxy] Fetching:', imageUrl);
    
    // Validate it's a soundcloud image
    if (!imageUrl.includes('sndcdn.com')) {
      return c.text('Invalid image source', 403);
    }
    
    // Fetch the image
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://soundcloud.com/',
      }
    });
    
    if (!response.ok) {
      console.log('[Image Proxy] Failed to fetch image:', response.status);
      
      // Try alternative URLs if the original fails
      if (imageUrl.includes('-t500x500')) {
        // Try original size
        const originalUrl = imageUrl.replace('-t500x500', '-original');
        const originalResponse = await fetch(originalUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://soundcloud.com/',
          }
        });
        
        if (originalResponse.ok) {
          return new Response(originalResponse.body, {
            headers: {
              'Content-Type': originalResponse.headers.get('Content-Type') || 'image/jpeg',
              'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
              'Access-Control-Allow-Origin': '*',
            }
          });
        }
      }
      
      // If we have a track ID, try to fetch fresh artwork
      if (trackId) {
        console.log('[Image Proxy] Trying to fetch fresh artwork for track:', trackId);
        const artworkService = new ArtworkService(c.env);
        const freshUrl = await artworkService.getFreshArtworkUrl(trackId);
        
        if (freshUrl) {
          // Try the fresh URL
          const freshResponse = await fetch(freshUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Referer': 'https://soundcloud.com/',
            }
          });
          
          if (freshResponse.ok) {
            return new Response(freshResponse.body, {
              headers: {
                'Content-Type': freshResponse.headers.get('Content-Type') || 'image/jpeg',
                'Cache-Control': 'public, max-age=86400',
                'Access-Control-Allow-Origin': '*',
              }
            });
          }
        }
      }
      
      // Return a placeholder image
      return c.redirect('/api/images/placeholder.svg');
    }
    
    // Return the image with proper headers
    return new Response(response.body, {
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
        'Access-Control-Allow-Origin': '*',
      }
    });
    
  } catch (error) {
    console.error('[Image Proxy] Error:', error);
    return c.text('Failed to fetch image', 500);
  }
});

// Placeholder image endpoint
app.get('/placeholder.svg', (c) => {
  const svg = `<svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
    <rect width="200" height="200" fill="#2a2a2a"/>
    <path d="M80 140V60l60-10v65" stroke="#666" stroke-width="3" fill="none"/>
    <circle cx="65" cy="140" r="15" fill="#666"/>
    <circle cx="125" cy="115" r="15" fill="#666"/>
  </svg>`;
  
  return c.body(svg, 200, {
    'Content-Type': 'image/svg+xml',
    'Cache-Control': 'public, max-age=86400',
  });
});

export default app;