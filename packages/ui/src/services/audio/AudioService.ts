export interface AudioService {
  findAudioElement(): HTMLAudioElement | null;
  play(): Promise<void>;
  pause(): void;
  getCurrentTime(): number;
  getDuration(): number;
  setCurrentTime(time: number): void;
  onTimeUpdate(callback: (time: number) => void): () => void;
  onEnded(callback: () => void): () => void;
}

// Browser extension audio service (finds audio on the page)
export class ExtensionAudioService implements AudioService {
  private audio: HTMLAudioElement | null = null;

  findAudioElement(): HTMLAudioElement | null {
    // Try to find audio element on the page
    const audioElements = document.querySelectorAll('audio');
    if (audioElements.length > 0) {
      this.audio = audioElements[0] as HTMLAudioElement;
      return this.audio;
    }
    return null;
  }

  async play(): Promise<void> {
    if (!this.audio) {
      this.findAudioElement();
    }
    
    if (this.audio) {
      try {
        await this.audio.play();
      } catch (error) {
        console.error('Failed to play audio, trying to click play button', error);
        // Try clicking play button as fallback
        const playButton = document.querySelector('button[title*="Play"], .playControl, .sc-button-play');
        if (playButton) {
          (playButton as HTMLElement).click();
        }
      }
    }
  }

  pause(): void {
    this.audio?.pause();
  }

  getCurrentTime(): number {
    return this.audio?.currentTime || 0;
  }

  getDuration(): number {
    return this.audio?.duration || 0;
  }

  setCurrentTime(time: number): void {
    if (this.audio) {
      this.audio.currentTime = time;
    }
  }

  onTimeUpdate(callback: (time: number) => void): () => void {
    const handler = () => callback(this.getCurrentTime());
    this.audio?.addEventListener('timeupdate', handler);
    return () => this.audio?.removeEventListener('timeupdate', handler);
  }

  onEnded(callback: () => void): () => void {
    this.audio?.addEventListener('ended', callback);
    return () => this.audio?.removeEventListener('ended', callback);
  }
}

// Web app audio service (creates its own audio element)
export class WebAudioService implements AudioService {
  private audio: HTMLAudioElement;

  constructor(audioUrl: string) {
    this.audio = new Audio(audioUrl);
  }

  findAudioElement(): HTMLAudioElement {
    return this.audio;
  }

  async play(): Promise<void> {
    await this.audio.play();
  }

  pause(): void {
    this.audio.pause();
  }

  getCurrentTime(): number {
    return this.audio.currentTime;
  }

  getDuration(): number {
    return this.audio.duration;
  }

  setCurrentTime(time: number): void {
    this.audio.currentTime = time;
  }

  onTimeUpdate(callback: (time: number) => void): () => void {
    const handler = () => callback(this.getCurrentTime());
    this.audio.addEventListener('timeupdate', handler);
    return () => this.audio.removeEventListener('timeupdate', handler);
  }

  onEnded(callback: () => void): () => void {
    this.audio.addEventListener('ended', callback);
    return () => this.audio.removeEventListener('ended', callback);
  }
}