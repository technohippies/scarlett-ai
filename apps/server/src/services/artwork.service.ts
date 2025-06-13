import type { Env } from '../types';
import { ImageService } from './image.service';

export class ArtworkService {
  constructor(private env: Env) {}

  /**
   * Get fresh artwork URL for a track by fetching from soundcloak
   */
  async getFreshArtworkUrl(trackId: string): Promise<string | null> {
    try {
      console.log('[ArtworkService] Fetching fresh artwork for:', trackId);
      
      // Fetch the soundcloak page
      const soundcloakUrl = `https://sc.maid.zone/${trackId}`;
      const response = await fetch(soundcloakUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml',
        }
      });
      
      if (!response.ok) {
        console.log('[ArtworkService] Failed to fetch soundcloak page:', response.status);
        return null;
      }
      
      const html = await response.text();
      
      // Extract artwork using ImageService
      const imageService = new ImageService(this.env.DB);
      const artworkData = imageService.extractSoundcloudImages(html);
      
      if (artworkData?.url) {
        console.log('[ArtworkService] Found fresh artwork:', artworkData.url);
        
        // Update the database with the new URL if we have DB access
        if (this.env.DB && trackId) {
          try {
            await this.env.DB.prepare(`
              UPDATE song_catalog 
              SET artwork_url = ?,
                  artwork_url_small = ?,
                  artwork_url_medium = ?,
                  artwork_url_large = ?,
                  artwork_cached_at = CURRENT_TIMESTAMP
              WHERE track_id = ?
            `).bind(
              artworkData.url,
              artworkData.small,
              artworkData.medium,
              artworkData.large,
              trackId
            ).run();
            
            console.log('[ArtworkService] Updated database with fresh artwork');
          } catch (error) {
            console.error('[ArtworkService] Failed to update database:', error);
          }
        }
        
        return artworkData.url;
      }
      
      return null;
    } catch (error) {
      console.error('[ArtworkService] Error fetching fresh artwork:', error);
      return null;
    }
  }
}