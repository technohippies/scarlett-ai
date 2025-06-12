// Sound utility for playing feedback sounds
export class SoundManager {
  private static instance: SoundManager;
  private sounds: Map<string, HTMLAudioElement> = new Map();
  private enabled: boolean = true;

  private constructor() {
    // Preload sounds
    this.loadSound('correct', '/sounds/correct.mp3');
    this.loadSound('incorrect', '/sounds/incorrect.mp3');
  }

  static getInstance(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager();
    }
    return SoundManager.instance;
  }

  private loadSound(name: string, path: string) {
    if (typeof window === 'undefined') return;
    
    const audio = new Audio(path);
    audio.preload = 'auto';
    audio.volume = 0.5; // Default volume
    this.sounds.set(name, audio);
  }

  play(soundName: 'correct' | 'incorrect') {
    if (!this.enabled) return;
    
    const audio = this.sounds.get(soundName);
    if (audio) {
      // Clone the audio to allow overlapping sounds
      const clone = audio.cloneNode() as HTMLAudioElement;
      clone.volume = audio.volume;
      clone.play().catch(err => {
        console.warn('Failed to play sound:', err);
      });
    }
  }

  setVolume(volume: number) {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    this.sounds.forEach(audio => {
      audio.volume = clampedVolume;
    });
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  isEnabled() {
    return this.enabled;
  }
}

// Export singleton instance
export const soundManager = SoundManager.getInstance();