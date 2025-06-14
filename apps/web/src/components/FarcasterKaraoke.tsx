import type { Component } from 'solid-js';
import { createSignal, onMount, createEffect, Show, Match, Switch } from 'solid-js';
import { 
  FarcasterKaraokeView, 
  CompletionView,
  Countdown, 
  useKaraokeSession, 
  I18nProvider,
  LyricDetailSlider,
  getImageUrl,
  type LyricLine,
  type KaraokeResults
} from '@scarlett/ui';
import { PracticeExercises } from './PracticeExercises';
import { apiService } from '../services/api';
import sdk from '@farcaster/frame-sdk';

// Global caches for translations and annotations - persist across component instances
const translationCache = new Map<string, string>();
const annotationsCache = new Map<string, any[]>();
const explanationCache = new Map<string, string>();

// Load translations from localStorage on startup
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    const savedTranslations = localStorage.getItem('scarlett_translations');
    if (savedTranslations) {
      const parsed = JSON.parse(savedTranslations);
      Object.entries(parsed).forEach(([key, value]) => {
        translationCache.set(key, value as string);
      });
      console.log('[Cache] Loaded', translationCache.size, 'translations from localStorage');
    }
    
    // Load explanations from localStorage
    const savedExplanations = localStorage.getItem('scarlett_explanations');
    if (savedExplanations) {
      const parsed = JSON.parse(savedExplanations);
      Object.entries(parsed).forEach(([key, value]) => {
        explanationCache.set(key, value as string);
      });
      console.log('[Cache] Loaded', explanationCache.size, 'explanations from localStorage');
    }
  } catch (e) {
    console.error('[Cache] Failed to load from localStorage:', e);
  }
}

// Save translations to localStorage whenever cache is updated
function saveTranslationToCache(key: string, value: string) {
  translationCache.set(key, value);
  
  // Also save to localStorage
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const cacheObject = Object.fromEntries(translationCache);
      localStorage.setItem('scarlett_translations', JSON.stringify(cacheObject));
      console.log('[Cache] Saved', translationCache.size, 'translations to localStorage');
    } catch (e) {
      console.error('[Cache] Failed to save translations to localStorage:', e);
    }
  }
}

// Save explanations to localStorage whenever cache is updated
function saveExplanationToCache(key: string, value: string) {
  explanationCache.set(key, value);
  
  // Also save to localStorage
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const cacheObject = Object.fromEntries(explanationCache);
      localStorage.setItem('scarlett_explanations', JSON.stringify(cacheObject));
      console.log('[Cache] Saved', explanationCache.size, 'explanations to localStorage');
    } catch (e) {
      console.error('[Cache] Failed to save explanations to localStorage:', e);
    }
  }
}

interface FarcasterKaraokeProps {
  songUrl: string;
  lyrics: LyricLine[];
  trackId: string;
  title: string;
  artist: string;
  artworkUrl?: string;
  songCatalogId?: string;
  geniusSongId?: number;
  apiUrl?: string;
  onStartCheck?: (startSession: () => void) => void;
  onBack?: () => void;
}

type ViewState = 'karaoke' | 'completion' | 'practice';

export const FarcasterKaraoke: Component<FarcasterKaraokeProps> = (props) => {
  const [score, setScore] = createSignal<number | null>(null);
  const [rank, setRank] = createSignal<number | null>(null);
  const [viewState, setViewState] = createSignal<ViewState>('karaoke');
  const [completionData, setCompletionData] = createSignal<KaraokeResults | null>(null);
  const [selectedLyric, setSelectedLyric] = createSignal<{ lyric: LyricLine; index: number } | null>(null);
  const [showLyricDetail, setShowLyricDetail] = createSignal(false);
  const [lyricTranslation, setLyricTranslation] = createSignal<string | undefined>();
  const [lyricAnnotations, setLyricAnnotations] = createSignal<any[] | undefined>();
  const [isLoadingLyricDetail, setIsLoadingLyricDetail] = createSignal(false);
  const [isTranslating, setIsTranslating] = createSignal(false);
  
  // Log cache status on component mount
  onMount(() => {
    console.log('[FarcasterKaraoke] Component mounted, cache status:', {
      translationCacheSize: translationCache.size,
      translationKeys: Array.from(translationCache.keys()),
      annotationsCacheSize: annotationsCache.size,
      annotationKeys: Array.from(annotationsCache.keys()),
      explanationCacheSize: explanationCache.size,
      explanationKeys: Array.from(explanationCache.keys())
    });
  });
  
  // Construct audio URL based on trackId
  const getAudioUrl = () => {
    // Check if it's a SoundCloud trackId (contains forward slash)
    if (props.trackId.includes('/')) {
      // Use the server's proxy endpoint that handles CORS
      const apiUrl = props.apiUrl || import.meta.env.VITE_API_URL || 'http://localhost:8787';
      return `${apiUrl}/api/audio/proxy/${props.trackId}`;
    }
    
    // For other tracks, use the provided songUrl or empty
    // Don't use soundhelix as it has CORS issues
    return props.songUrl || '';
  };
  
  const audioUrl = getAudioUrl();
  
  // Create audio element with the actual URL
  const [audio] = createSignal(new Audio());
  
  // Initialize audio element
  onMount(() => {
    const audioElement = audio();
    
    if (audioUrl) {
      // Add error handler first
      audioElement.addEventListener('error', (e) => {
        console.error('[FarcasterKaraoke] Audio error:', {
          error: audioElement.error,
          src: audioElement.src,
          readyState: audioElement.readyState,
          networkState: audioElement.networkState
        });
        
        // Try to handle specific error types
        if (audioElement.error?.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
          console.error('[FarcasterKaraoke] Audio format not supported');
        }
      });
      
      // Add loadeddata handler
      audioElement.addEventListener('loadeddata', () => {
        console.log('[FarcasterKaraoke] Audio loaded successfully');
      });
      
      // Set source after handlers are attached
      audioElement.src = audioUrl;
      
      // Don't set crossOrigin for local proxy as it handles CORS
      if (!audioUrl.includes('localhost')) {
        audioElement.crossOrigin = 'anonymous';
      }
      
      // Preload the audio
      audioElement.preload = 'auto';
      
      // Set the audio element in the karaoke session
      setAudioElement(audioElement);
    }
  });
  
  
  const {
    isPlaying,
    currentTime,
    countdown,
    startSession,
    stopSession,
    score: sessionScore,
    lineScores,
    setAudioElement
  } = useKaraokeSession({
    lyrics: props.lyrics,
    audioElement: undefined, // Will be set after mount
    trackId: props.trackId,
    songData: {
      title: props.title,
      artist: props.artist
    },
    songCatalogId: props.songCatalogId,
    apiUrl: props.apiUrl || import.meta.env.VITE_API_URL || 'http://localhost:8787',
    onComplete: async (results) => {
      setCompletionData(results);
      setViewState('completion');
      
      // Save performance and update streak
      try {
        // Get user ID
        const frameContext = await sdk.context.catch(() => null);
        const userId = frameContext?.user?.fid 
          ? `farcaster-${frameContext.user.fid}` 
          : 'demo-user';
        
        // Save performance
        const performanceResult = await apiService.savePerformance({
          userId,
          songCatalogId: props.songCatalogId || props.trackId,
          score: results.score,
          accuracy: results.accuracy,
          sessionDurationMs: results.duration,
          linesCompleted: results.linesCompleted,
          totalLines: results.totalLines,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        });
        
        // Update UI if user achieved #1 or improved streak
        if (performanceResult.streak || performanceResult.hasTopPosition) {
          // Could show a celebration or update the header
          console.log('Performance saved:', performanceResult);
        }
      } catch (error) {
        console.error('Failed to save performance:', error);
      }
    }
  });

  // Add a function to stop/pause or go back
  const handleStop = () => {
    if (isPlaying()) {
      // If playing, just stop the session
      stopSession();
    } else {
      // If not playing, go back to song list
      props.onBack?.();
    }
  };

  // Handle practice errors navigation
  const handlePracticeErrors = async () => {
    setViewState('practice');
  };

  // Handle retry
  const handleRetry = () => {
    setViewState('karaoke');
    setCompletionData(null);
    setScore(null);
    setRank(null);
    // Reset the audio
    if (audio) {
      audio.currentTime = 0;
    }
  };

  // Handle back from practice
  const handleBackFromPractice = () => {
    setViewState('completion');
  };

  // Handle lyric click
  const handleLyricClick = (lyric: LyricLine, index: number) => {
    if (!isPlaying()) {
      console.log('[LyricClick] Opening detail for:', lyric.text);
      
      // Clear previous translation to show spinner
      setLyricTranslation(undefined);
      setLyricAnnotations(undefined);
      setIsTranslating(false);
      
      setSelectedLyric({ lyric, index });
      setShowLyricDetail(true);
      
      // Check cache for translation
      // Users should see translations in their native language
      const userLang = getUserLanguage();
      let targetLang: 'en' | 'es' | 'zh' | 'zh-CN' | 'zh-TW' | null = null;
      
      console.log('[LyricClick] User language:', userLang);
      
      // Determine target language based on user's native language
      // But first, try to detect the source language of the lyrics
      const looksLikeEnglish = /^[A-Za-z\s\.,!?'"]+$/.test(lyric.text);
      const looksLikeSpanish = /[áéíóúñ¿¡]/i.test(lyric.text);
      const looksLikeChinese = /[一-龥]/.test(lyric.text);
      
      console.log('[LyricClick] Lyric language detection:', {
        text: lyric.text,
        looksLikeEnglish,
        looksLikeSpanish,
        looksLikeChinese
      });
      
      if (userLang.startsWith('es')) {
        // Spanish users → translate to Spanish (unless already Spanish)
        if (!looksLikeSpanish) {
          targetLang = 'es';
        }
      } else if (userLang.startsWith('en')) {
        // English users → translate to English (unless already English)
        if (!looksLikeEnglish || looksLikeSpanish || looksLikeChinese) {
          targetLang = 'en';
        }
      } else if (userLang.startsWith('zh')) {
        // Chinese users → translate to Chinese (unless already Chinese)
        if (!looksLikeChinese) {
          if (userLang === 'zh-tw' || userLang === 'zh-hk') {
            targetLang = 'zh-TW'; // Traditional Chinese
          } else {
            targetLang = 'zh-CN'; // Simplified Chinese
          }
        }
        console.log('[LyricClick] Chinese user - translating to:', targetLang);
      }
      
      console.log('[LyricClick] Target translation language:', targetLang);
      
      const cacheKey = targetLang ? `${lyric.text}:${targetLang}` : null;
      const cachedTranslation = cacheKey ? translationCache.get(cacheKey) : null;
      
      console.log('[Translation Cache]', {
        cacheKey,
        hasCache: !!cachedTranslation,
        cacheSize: translationCache.size,
        allKeys: Array.from(translationCache.keys())
      });
      
      if (cachedTranslation) {
        console.log('[LyricClick] Found cached translation:', cachedTranslation);
        setLyricTranslation(cachedTranslation);
      } else if (targetLang === null) {
        // For unsupported languages, don't show translation
        setLyricTranslation(undefined);
      }
      
      // Check cache for explanations (both meaning and grammar)
      const allAnnotations = [];
      
      // Determine target language for explanations
      let explanationLang = 'en';
      if (userLang.startsWith('zh')) {
        explanationLang = 'zh';
      } else if (userLang.startsWith('es')) {
        explanationLang = 'es';
      }
      
      // Check for cached meaning explanation
      const meaningCacheKey = `${lyric.text}:meaning:${explanationLang}`;
      const cachedMeaning = explanationCache.get(meaningCacheKey);
      if (cachedMeaning) {
        console.log('[LyricClick] Found cached meaning explanation');
        allAnnotations.push({
          word: lyric.text,
          meaning: cachedMeaning,
          pronunciation: undefined
        });
      }
      
      // Check for cached grammar explanation
      const grammarCacheKey = `${lyric.text}:grammar:${explanationLang}`;
      const cachedGrammar = explanationCache.get(grammarCacheKey);
      if (cachedGrammar) {
        console.log('[LyricClick] Found cached grammar explanation');
        allAnnotations.push({
          word: lyric.text,
          meaning: cachedGrammar,
          pronunciation: 'grammar'
        });
      }
      
      // Also check old annotationsCache for backward compatibility
      const oldCachedAnnotations = annotationsCache.get(lyric.text);
      if (oldCachedAnnotations) {
        console.log('[LyricClick] Found old cached annotations');
        allAnnotations.push(...oldCachedAnnotations);
      }
      
      if (allAnnotations.length > 0) {
        setLyricAnnotations(allAnnotations);
      }
    }
  };

  // Handle explain request
  const handleExplain = async (type: 'meaning' | 'grammar') => {
    console.log('[Explain] Starting explanation request:', type);
    if (!selectedLyric() || isLoadingLyricDetail()) {
      console.log('[Explain] Already loading or no lyric selected');
      return;
    }
    
    const lyric = selectedLyric()!;
    const lyricText = lyric.lyric.text;
    const userLang = getUserLanguage();
    
    // Determine target language for explanation
    let targetLang = 'en';
    if (userLang.startsWith('zh')) {
      targetLang = 'zh';
    } else if (userLang.startsWith('es')) {
      targetLang = 'es';
    }
    
    console.log('[Explain] User language:', userLang, 'Target language:', targetLang);
    
    // Create cache key with type and target language
    const cacheKey = `${lyricText}:${type}:${targetLang}`;
    
    // Check cache first
    const cached = explanationCache.get(cacheKey);
    if (cached) {
      console.log('[Explain] Found in cache - NOT calling API:', {
        cacheKey,
        cachedValue: cached,
        cacheSize: explanationCache.size
      });
      // Merge with existing annotations
      const existingAnnotations = lyricAnnotations() || [];
      const otherAnnotations = existingAnnotations.filter(a => 
        a.word !== lyricText || (type === 'grammar' ? a.pronunciation === undefined : a.pronunciation !== undefined)
      );
      setLyricAnnotations([...otherAnnotations, {
        word: lyricText,
        meaning: cached,
        pronunciation: type === 'grammar' ? 'grammar' : undefined
      }]);
      return;
    }
    
    console.log('[Explain] NOT in cache - will call API:', {
      cacheKey,
      cacheSize: explanationCache.size,
      existingKeys: Array.from(explanationCache.keys())
    });
    
    setIsLoadingLyricDetail(true);
    // Don't clear all annotations, just remove the one we're updating
    const existingAnnotations = lyricAnnotations() || [];
    const otherAnnotations = existingAnnotations.filter(a => 
      a.word !== lyricText || (type === 'grammar' ? a.pronunciation === undefined : a.pronunciation !== undefined)
    );
    setLyricAnnotations(otherAnnotations);
    
    try {
      const stream = await apiService.explainLyric({
        songTitle: props.title,
        artistName: props.artist,
        lyricLine: lyricText,
        lineIndex: lyric.index,
        allLyrics: props.lyrics.map(l => l.text),
        targetLang,
        explanationType: type,
        geniusSongId: props.geniusSongId
      });
      
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      
      let explanation = '';
      let buffer = '';
      let hasAnnotations = false;
      let geniusUrl = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            
            try {
              const parsed = JSON.parse(data);
              
              if (parsed.type === 'start') {
                hasAnnotations = parsed.hasAnnotations;
                geniusUrl = parsed.geniusUrl;
                console.log('[Explain] Start data:', { hasAnnotations, geniusUrl });
              } else if (parsed.type === 'content') {
                explanation += parsed.content;
                // Update annotations with streaming explanation
                // Merge with other annotations
                const currentAnnotations = lyricAnnotations() || [];
                const otherAnnotations = currentAnnotations.filter(a => 
                  a.word !== lyricText || (type === 'grammar' ? a.pronunciation === undefined : a.pronunciation !== undefined)
                );
                setLyricAnnotations([...otherAnnotations, {
                  word: lyricText,
                  meaning: explanation,
                  pronunciation: type === 'grammar' ? 'grammar' : undefined
                }]);
              } else if (parsed.type === 'done') {
                console.log('[Explain] Complete, annotation count:', parsed.annotationCount);
              }
            } catch (e) {
              console.error('[Explain] Failed to parse SSE:', e);
            }
          }
        }
      }
      
      // Save to cache (both memory and localStorage)
      saveExplanationToCache(cacheKey, explanation);
      console.log('[Explain] Saved to cache:', {
        cacheKey,
        explanation: explanation.substring(0, 100) + '...',
        newCacheSize: explanationCache.size,
        allKeys: Array.from(explanationCache.keys())
      });
      
      // Also update the old annotationsCache for backward compatibility
      const annotationCacheKey = `${lyricText}:${type}`;
      annotationsCache.set(annotationCacheKey, [{
        word: lyricText,
        meaning: explanation,
        pronunciation: type === 'grammar' ? 'grammar' : undefined
      }]);
      
    } catch (error) {
      console.error('[Explain] Failed:', error);
      // Keep existing annotations and add error message
      const currentAnnotations = lyricAnnotations() || [];
      const otherAnnotations = currentAnnotations.filter(a => 
        a.word !== lyricText || (type === 'grammar' ? a.pronunciation === undefined : a.pronunciation !== undefined)
      );
      setLyricAnnotations([...otherAnnotations, {
        word: lyricText,
        meaning: 'Failed to load explanation',
        pronunciation: type === 'grammar' ? 'grammar' : undefined
      }]);
    } finally {
      setIsLoadingLyricDetail(false);
    }
  };

  // Handle translation request
  const handleTranslate = async (targetLang: 'en' | 'es' | 'zh' | 'zh-CN' | 'zh-TW' | null) => {
    console.log('[Translation] Starting translation to', targetLang);
    if (!selectedLyric() || isTranslating() || !targetLang) {
      console.log('[Translation] Already translating, no lyric selected, or no target language');
      return;
    }
    
    const lyricText = selectedLyric()!.lyric.text;
    const cacheKey = `${lyricText}:${targetLang}`;
    
    // Check cache first
    const cached = translationCache.get(cacheKey);
    if (cached) {
      console.log('[Translation] Found in cache - NOT calling API:', {
        cacheKey,
        cachedValue: cached,
        cacheSize: translationCache.size
      });
      setLyricTranslation(cached);
      return;
    }
    
    console.log('[Translation] NOT in cache - will call API:', {
      cacheKey,
      cacheSize: translationCache.size,
      existingKeys: Array.from(translationCache.keys())
    });
    
    setIsTranslating(true);
    setIsLoadingLyricDetail(true);
    setLyricTranslation(''); // Start with empty string for streaming
    console.log('[Translation] Starting stream...');
    
    try {
      const stream = await apiService.translateLyric(lyricText, targetLang);
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      
      let translatedText = '';
      let buffer = '';
      let chunkCount = 0;
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log('[Translation] Stream complete, total chunks:', chunkCount);
          break;
        }
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            
            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                chunkCount++;
                translatedText += parsed.text;
                console.log(`[Translation] Chunk ${chunkCount}:`, parsed.text, '| Total:', translatedText.length, 'chars');
                // Update UI immediately with streaming text
                setLyricTranslation(translatedText);
              }
            } catch (e) {
              console.error('[Translation] Failed to parse SSE:', e, 'Line:', line);
            }
          }
        }
      }
      
      // Final update
      console.log('[Translation] Final text:', translatedText);
      setLyricTranslation(translatedText);
      
      // Save to cache (both memory and localStorage)
      saveTranslationToCache(cacheKey, translatedText);
      console.log('[Translation] Saved to cache:', {
        cacheKey,
        translatedText,
        newCacheSize: translationCache.size,
        allKeys: Array.from(translationCache.keys())
      });
    } catch (error) {
      console.error('[Translation] Translation failed:', error);
      setLyricTranslation('Translation failed');
    } finally {
      setIsLoadingLyricDetail(false);
      setIsTranslating(false);
    }
  };

  // Handle annotation request
  const handleAnnotate = async () => {
    if (!selectedLyric()) return;
    
    const lyricText = selectedLyric()!.lyric.text;
    
    // Check cache first
    const cached = annotationsCache.get(lyricText);
    if (cached) {
      setLyricAnnotations(cached);
      return;
    }
    
    setIsLoadingLyricDetail(true);
    try {
      const annotations = await apiService.annotateLyric(lyricText);
      
      // Save to cache
      annotationsCache.set(lyricText, annotations);
      setLyricAnnotations(annotations);
    } catch (error) {
      console.error('Annotation failed:', error);
      setLyricAnnotations([]);
    } finally {
      setIsLoadingLyricDetail(false);
    }
  };

  // Detect user language
  const getUserLanguage = () => {
    const browserLang = navigator.language.toLowerCase();
    console.log('[FarcasterKaraoke] Browser language detected:', browserLang);
    console.log('[FarcasterKaraoke] navigator.language:', navigator.language);
    console.log('[FarcasterKaraoke] navigator.languages:', navigator.languages);
    return browserLang;
  };

  return (
    <div class="relative h-screen overflow-hidden">
      <Switch>
        <Match when={viewState() === 'karaoke'}>
          <FarcasterKaraokeView
            songTitle={props.title}
            artist={props.artist}
            artworkUrl={getImageUrl(props.artworkUrl, props.apiUrl || import.meta.env.VITE_API_URL || 'http://localhost:8787', props.trackId)}
            score={(sessionScore() || 0) > 0 ? sessionScore() : null}
            rank={rank()}
            lyrics={props.lyrics}
            currentTime={currentTime()}
            isPlaying={isPlaying() || countdown() !== null}
            onStart={props.onStartCheck ? () => props.onStartCheck!(startSession) : startSession}
            onBack={handleStop}
            leaderboard={[]}
            lineScores={lineScores()}
            onLyricClick={handleLyricClick}
          />
        </Match>
        
        <Match when={viewState() === 'completion' && completionData()}>
            <Show when={!completionData()!.isLoading} fallback={
              <div class="flex items-center justify-center h-full bg-base">
                <div class="text-center">
                  <div class="animate-spin rounded-full h-16 w-16 border-b-2 border-accent-primary mx-auto mb-4"></div>
                  <p class="text-lg text-secondary">Calculating your final score...</p>
                  <p class="text-sm text-tertiary mt-2">Analyzing full performance</p>
                </div>
              </div>
            }>
              <CompletionView
                score={completionData()!.score}
                rank={1}
                speed={1.0}
                feedbackText={
                  completionData()!.score >= 95 ? "Perfect! You nailed it!" :
                  completionData()!.score >= 85 ? "Excellent performance!" :
                  completionData()!.score >= 70 ? "Great job!" :
                  completionData()!.score >= 50 ? "Good effort!" :
                  "Keep practicing!"
                }
                onPractice={completionData()!.needsWorkLines > 0 ? handlePracticeErrors : undefined}
              />
            </Show>
        </Match>
        
        <Match when={viewState() === 'practice'}>
          <PracticeExercises
            sessionId={completionData()?.sessionId}
            onBack={handleBackFromPractice}
          />
        </Match>
      </Switch>
      
      {/* Shared countdown component - overlays everything */}
      <Countdown count={countdown()} />
      
      {/* Lyric Detail Slider */}
      <LyricDetailSlider
        isOpen={showLyricDetail()}
        lyric={{
          text: selectedLyric()?.lyric.text || '',
          translatedText: lyricTranslation(),
          annotations: lyricAnnotations()
        }}
        songContext={{
          title: props.title,
          artist: props.artist,
          lineIndex: selectedLyric()?.index || 0,
          totalLines: props.lyrics.length
        }}
        userLanguage={getUserLanguage()}
        isLoading={isLoadingLyricDetail()}
        onClose={() => setShowLyricDetail(false)}
        onTranslate={(lang) => lang && handleTranslate(lang)}
        onExplainMeaning={() => handleExplain('meaning')}
        onExplainGrammar={() => handleExplain('grammar')}
      />
    </div>
  );
};