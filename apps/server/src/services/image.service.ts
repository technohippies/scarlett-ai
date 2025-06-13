import type { D1Database } from '@cloudflare/workers-types';

export interface ImageMetadata {
  url: string;
  small?: string;
  medium?: string;
  large?: string;
  source?: string;
  cachedAt?: string;
}

export class ImageService {
  constructor(private db: D1Database) {}

  /**
   * Extract and process image URLs from soundcloak HTML
   */
  extractSoundcloudImages(html: string): ImageMetadata | null {
    try {
      // Try multiple patterns to extract artwork image
      let artworkUrl: string | null = null;
      
      // Pattern 1: Image with width="300px" (main artwork image)
      let artworkMatch = html.match(/<img[^>]+src="([^"]+)"[^>]*width="300px"/);
      if (artworkMatch) {
        artworkUrl = artworkMatch[1];
      }
      
      // Pattern 2: Any image with sndcdn.com in the URL
      if (!artworkUrl) {
        artworkMatch = html.match(/<img[^>]+src="([^"]*sndcdn\.com\/artworks[^"]+)"[^>]*>/);
        if (artworkMatch) {
          artworkUrl = artworkMatch[1];
        }
      }
      
      // Pattern 3: Image inside track page main content
      if (!artworkUrl) {
        artworkMatch = html.match(/<div[^>]*class="[^"]*track[^"]*"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"[^>]*>/);
        if (artworkMatch) {
          artworkUrl = artworkMatch[1];
        }
      }
      
      // Pattern 4: Any image that looks like album art (excluding avatars)
      if (!artworkUrl) {
        const allImages = html.matchAll(/<img[^>]+src="([^"]+)"[^>]*>/g);
        for (const match of allImages) {
          const url = match[1];
          // Check if it's likely album art (not avatar or other icons)
          if (url.includes('artworks') || url.includes('t500x500') || url.includes('t300x300')) {
            artworkUrl = url;
            break;
          }
        }
      }
      
      if (!artworkUrl) {
        console.log('[ImageService] No artwork found in HTML');
        return null;
      }
      
      console.log('[ImageService] Found artwork URL:', artworkUrl);
      
      // For proxy URLs, extract the original URL first
      if (artworkUrl.includes('/_/proxy/images?url=')) {
        try {
          const urlParam = artworkUrl.split('url=')[1];
          const originalUrl = decodeURIComponent(urlParam);
          console.log('[ImageService] Extracted original URL from proxy:', originalUrl);
          
          // Process as soundcloud URL if it contains sndcdn.com
          if (originalUrl.includes('sndcdn.com')) {
            // Extract base URL without size suffix
            // Pattern: https://i1.sndcdn.com/artworks-xxx-xxx-t500x500.jpg
            const baseMatch = originalUrl.match(/^(.*artworks-[^-]+-[^-]+)(-t\d+x\d+)?(\.\w+)$/);
            if (baseMatch) {
              const baseUrl = baseMatch[1];
              const extension = baseMatch[3] || '.jpg';
              
              return {
                url: originalUrl,
                small: baseUrl + '-t200x200' + extension,
                medium: baseUrl + '-t500x500' + extension,
                large: baseUrl + '-original' + extension,
                source: 'soundcloud'
              };
            }
            
            // Fallback if pattern doesn't match
            return {
              url: originalUrl,
              source: 'soundcloud'
            };
          }
          
          return {
            url: originalUrl,
            source: 'soundcloud'
          };
        } catch (error) {
          console.error('[ImageService] Failed to extract URL from proxy:', error);
          // Fall back to using the proxy URL as-is
          return {
            url: artworkUrl,
            source: 'soundcloak-proxy'
          };
        }
      }
      
      // Handle direct soundcloud URLs
      if (artworkUrl.includes('sndcdn.com')) {
        // Extract base URL without size suffix
        const baseMatch = artworkUrl.match(/^(.*artworks-[^-]+-[^-]+)(-t\d+x\d+)?(\.\w+)$/);
        if (baseMatch) {
          const baseUrl = baseMatch[1];
          const extension = baseMatch[3] || '.jpg';
          
          return {
            url: artworkUrl,
            small: baseUrl + '-t200x200' + extension,
            medium: baseUrl + '-t500x500' + extension,
            large: baseUrl + '-original' + extension,
            source: 'soundcloud'
          };
        }
        
        // Fallback
        return {
          url: artworkUrl,
          source: 'soundcloud'
        };
      }

      return {
        url: artworkUrl,
        source: 'unknown'
      };
    } catch (error) {
      console.error('[ImageService] Failed to extract images:', error);
      return null;
    }
  }

  /**
   * Process a soundcloud image URL to get different sizes
   */
  processSoundcloudUrl(url: string): ImageMetadata {
    if (!url.includes('sndcdn.com')) {
      return { url, source: 'unknown' };
    }

    // Extract base URL without size suffix
    const baseUrl = url.replace(/-t\d+x\d+(\.\w+)$/, '$1');
    const extension = url.match(/\.\w+$/)?.[0] || '.jpg';
    const urlWithoutExt = baseUrl.replace(/\.\w+$/, '');

    return {
      url: url,
      small: `${urlWithoutExt}-t200x200${extension}`,
      medium: `${urlWithoutExt}-t500x500${extension}`,
      large: `${urlWithoutExt}-original${extension}`,
      source: 'soundcloud',
      cachedAt: new Date().toISOString()
    };
  }

  /**
   * Cache image metadata in the database
   */
  async cacheImageMetadata(
    songId: string,
    images: ImageMetadata
  ): Promise<void> {
    try {
      await this.db.prepare(`
        UPDATE song_catalog 
        SET 
          artwork_url = ?,
          artwork_url_small = ?,
          artwork_url_medium = ?,
          artwork_url_large = ?,
          artwork_source = ?,
          artwork_cached_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(
        images.url,
        images.small || images.url,
        images.medium || images.url,
        images.large || images.url,
        images.source || 'unknown',
        songId
      ).run();
    } catch (error) {
      console.error('[ImageService] Failed to cache image metadata:', error);
    }
  }

  /**
   * Get cached image metadata for a song
   */
  async getCachedImages(songId: string): Promise<ImageMetadata | null> {
    try {
      const result = await this.db.prepare(`
        SELECT 
          artwork_url as url,
          artwork_url_small as small,
          artwork_url_medium as medium,
          artwork_url_large as large,
          artwork_source as source,
          artwork_cached_at as cachedAt
        FROM song_catalog
        WHERE id = ?
      `).bind(songId).first();

      if (!result || !result.url) return null;

      return {
        url: result.url as string,
        small: result.small as string,
        medium: result.medium as string,
        large: result.large as string,
        source: result.source as string,
        cachedAt: result.cachedAt as string
      };
    } catch (error) {
      console.error('[ImageService] Failed to get cached images:', error);
      return null;
    }
  }

  /**
   * Extract additional metadata from soundcloak page
   */
  extractSoundcloudMetadata(html: string): Record<string, any> {
    const metadata: Record<string, any> = {};

    try {
      // Extract likes
      const likesMatch = html.match(/<p>(\d+) likes<\/p>/);
      if (likesMatch) {
        metadata.likes = parseInt(likesMatch[1].replace(/,/g, ''));
      }

      // Extract plays
      const playsMatch = html.match(/<p>(\d+) plays<\/p>/);
      if (playsMatch) {
        metadata.plays = parseInt(playsMatch[1].replace(/,/g, ''));
      }

      // Extract reposts
      const repostsMatch = html.match(/<p>(\d+) reposts<\/p>/);
      if (repostsMatch) {
        metadata.reposts = parseInt(repostsMatch[1].replace(/,/g, ''));
      }

      // Extract genre
      const genreMatch = html.match(/<a[^>]+href="\/tags\/([^"]+)"[^>]*><p class="tag">([^<]+)<\/p><\/a>/);
      if (genreMatch) {
        metadata.genre = genreMatch[2];
      }

      // Extract dates
      const createdMatch = html.match(/<p>Created: ([^<]+)<\/p>/);
      if (createdMatch) {
        metadata.createdAt = createdMatch[1];
      }

      const modifiedMatch = html.match(/<p>Last modified: ([^<]+)<\/p>/);
      if (modifiedMatch) {
        metadata.modifiedAt = modifiedMatch[1];
      }

      // Extract user info
      const userMatch = html.match(/<a class="listing" href="\/([^"]+)"><img[^>]+src="([^"]+)"[^>]*><div class="meta"><h3>([^<]+)<\/h3><span>([^<]+)<\/span>/);
      if (userMatch) {
        metadata.user = {
          username: userMatch[1],
          avatarUrl: userMatch[2],
          displayName: userMatch[4]
        };
      }

    } catch (error) {
      console.error('[ImageService] Failed to extract metadata:', error);
    }

    return metadata;
  }

  /**
   * Update song with soundcloud metadata
   */
  async updateSongMetadata(
    songId: string,
    metadata: Record<string, any>
  ): Promise<void> {
    try {
      const updates: string[] = [];
      const bindings: any[] = [];

      if (metadata.likes !== undefined) {
        updates.push('sc_likes_count = ?');
        bindings.push(metadata.likes);
      }

      if (metadata.plays !== undefined) {
        updates.push('sc_plays_count = ?');
        bindings.push(metadata.plays);
      }

      if (metadata.reposts !== undefined) {
        updates.push('sc_reposts_count = ?');
        bindings.push(metadata.reposts);
      }

      if (metadata.genre) {
        updates.push('sc_genre = ?');
        bindings.push(metadata.genre);
      }

      if (metadata.createdAt) {
        updates.push('sc_created_at = ?');
        bindings.push(metadata.createdAt);
      }

      if (metadata.modifiedAt) {
        updates.push('sc_modified_at = ?');
        bindings.push(metadata.modifiedAt);
      }

      if (metadata.user) {
        if (metadata.user.avatarUrl) {
          updates.push('sc_user_avatar_url = ?');
          bindings.push(metadata.user.avatarUrl);
        }
        if (metadata.user.displayName) {
          updates.push('sc_user_name = ?');
          bindings.push(metadata.user.displayName);
        }
      }

      if (updates.length > 0) {
        bindings.push(songId);
        await this.db.prepare(`
          UPDATE song_catalog 
          SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(...bindings).run();
      }
    } catch (error) {
      console.error('[ImageService] Failed to update metadata:', error);
    }
  }
}