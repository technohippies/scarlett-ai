export interface Translations {
  common: {
    buttons: {
      start: string;
      stop: string;
      continue: string;
      cancel: string;
      back: string;
      next: string;
      skip: string;
      save: string;
      share: string;
    };
    status: {
      loading: string;
      ready: string;
      recording: string;
      processing: string;
      error: string;
      success: string;
      offline: string;
    };
    speed: {
      label: string;
      slow: string;
      normal: string;
      fast: string;
    };
  };
  karaoke: {
    header: {
      title: string;
      subtitle: string;
      songBy: string;
    };
    lyrics: {
      loading: string;
      noLyrics: string;
      scrollPrompt: string;
    };
    recording: {
      listening: string;
      speak: string;
      processing: string;
    };
    scoring: {
      perfect: string;
      excellent: string;
      great: string;
      good: string;
      keepPracticing: string;
      score: string;
      accuracy: string;
      timing: string;
    };
    completion: {
      title: string;
      performanceComplete: string;
      yourScore: string;
      sharePrompt: string;
      shareMessage: string;
      playAgain: string;
      tryAnotherSong: string;
      downloadRecording: string;
    };
    leaderboard: {
      title: string;
      topPerformers: string;
      yourRank: string;
      anonymous: string;
    };
  };
  display: {
    scorePanel: {
      currentScore: string;
      bestScore: string;
      streak: string;
      multiplier: string;
    };
  };
  homepage: {
    hero: {
      title: string;
      subtitle: string;
      getStarted: string;
    };
    popularSongs: {
      title: string;
      subtitle: string;
    };
  };
}

export interface LocaleConfig {
  code: string;
  name: string;
  nativeName: string;
  flag?: string;
  direction: 'ltr' | 'rtl';
  dateFormat: string;
  numberFormat: {
    decimal: string;
    thousands: string;
  };
}

export type LocaleCode = 'en' | 'zh-CN';