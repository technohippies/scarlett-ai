export interface TrackInfo {
  trackId: string;
  title: string;
  artist: string;
  platform: 'soundcloud';
  url: string;
}

export class TrackDetector {
  /**
   * Detect current track from the page (SoundCloud only)
   */
  detectCurrentTrack(): TrackInfo | null {
    const url = window.location.href;
    
    // Only work on sc.maid.zone (SoundCloud proxy)
    if (url.includes('sc.maid.zone')) {
      return this.detectSoundCloudTrack();
    }
    
    return null;
  }


  /**
   * Extract track info from SoundCloud (sc.maid.zone)
   */
  private detectSoundCloudTrack(): TrackInfo | null {
    try {
      // SoundCloud URLs: sc.maid.zone/user/track-name
      const pathParts = window.location.pathname.split('/').filter(Boolean);
      if (pathParts.length < 2) return null;

      const artist = pathParts[0];
      const trackSlug = pathParts[1];
      
      // Try to get actual title from page (SoundCloud selectors)
      const titleSelectors = [
        '.soundTitle__title',
        '.trackItem__trackTitle', 
        'h1[itemprop="name"]',
        '.sound__header h1',
        '.sc-text-h4',
        '.sc-text-primary'
      ];

      let title = '';
      for (const selector of titleSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent) {
          title = element.textContent.trim();
          break;
        }
      }

      // Fallback to slug
      if (!title) {
        title = trackSlug.replace(/-/g, ' ');
      }

      // Clean up artist name
      const cleanArtist = artist.replace(/-/g, ' ').replace(/_/g, ' ');

      return {
        trackId: `${artist}/${trackSlug}`,
        title: title,
        artist: cleanArtist,
        platform: 'soundcloud',
        url: window.location.href,
      };
    } catch (error) {
      console.error('[TrackDetector] Error detecting SoundCloud track:', error);
      return null;
    }
  }


  /**
   * Watch for page changes (SoundCloud is a SPA)
   */
  watchForChanges(callback: (track: TrackInfo | null) => void): () => void {
    let currentUrl = window.location.href;
    let currentTrack = this.detectCurrentTrack();
    
    // Initial detection
    callback(currentTrack);

    // Watch for URL changes
    const checkForChanges = () => {
      const newUrl = window.location.href;
      if (newUrl !== currentUrl) {
        currentUrl = newUrl;
        const newTrack = this.detectCurrentTrack();
        
        // Only trigger callback if track actually changed
        const trackChanged = !currentTrack || !newTrack || 
          currentTrack.trackId !== newTrack.trackId;
          
        if (trackChanged) {
          currentTrack = newTrack;
          callback(newTrack);
        }
      }
    };

    // Poll for changes (SPAs don't always trigger proper navigation events)
    const interval = setInterval(checkForChanges, 1000);

    // Also listen for navigation events
    const handleNavigation = () => {
      setTimeout(checkForChanges, 100); // Small delay for DOM updates
    };

    window.addEventListener('popstate', handleNavigation);
    
    // Listen for pushstate/replacestate (SoundCloud uses these)
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = function(...args) {
      originalPushState.apply(history, args);
      handleNavigation();
    };
    
    history.replaceState = function(...args) {
      originalReplaceState.apply(history, args);
      handleNavigation();
    };

    // Return cleanup function
    return () => {
      clearInterval(interval);
      window.removeEventListener('popstate', handleNavigation);
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
    };
  }
}

export const trackDetector = new TrackDetector();