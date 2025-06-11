import { createSignal, onCleanup } from 'solid-js';
import type { LyricLine } from '../components/karaoke/LyricsDisplay';
import { createKaraokeAudioProcessor } from '../services/audio/karaokeAudioProcessor';
import { shouldChunkLines, calculateRecordingDuration } from '../services/karaoke/chunkingUtils';
import { KaraokeApiService } from '../services/karaoke/karaokeApi';
import type { ChunkInfo } from '../types/karaoke';

export interface UseKaraokeSessionOptions {
  lyrics: LyricLine[];
  onComplete?: (results: KaraokeResults) => void;
  audioElement?: HTMLAudioElement;
  trackId?: string;
  songData?: {
    title: string;
    artist: string;
    album?: string;
    duration?: number;
  };
  songCatalogId?: string;
  apiUrl?: string;
}

export interface KaraokeResults {
  score: number;
  accuracy: number;
  totalLines: number;
  perfectLines: number;
  goodLines: number;
  needsWorkLines: number;
  sessionId?: string;
  isLoading?: boolean;
}

export interface LineScore {
  lineIndex: number;
  score: number;
  transcription: string;
  feedback?: string;
}

export function useKaraokeSession(options: UseKaraokeSessionOptions) {
  const [isPlaying, setIsPlaying] = createSignal(false);
  const [currentTime, setCurrentTime] = createSignal(0);
  const [score, setScore] = createSignal(0);
  const [countdown, setCountdown] = createSignal<number | null>(null);
  const [sessionId, setSessionId] = createSignal<string | null>(null);
  const [lineScores, setLineScores] = createSignal<LineScore[]>([]);
  const [currentChunk, setCurrentChunk] = createSignal<ChunkInfo | null>(null);
  const [isRecording, setIsRecording] = createSignal(false);
  const [audioElement, setAudioElement] = createSignal<HTMLAudioElement | undefined>(options.audioElement);
  const [recordedChunks, setRecordedChunks] = createSignal<Set<number>>(new Set());
  
  let audioUpdateInterval: number | null = null;
  let recordingTimeout: number | null = null;
  
  const audioProcessor = createKaraokeAudioProcessor({
    sampleRate: 16000
  });
  
  const karaokeApi = new KaraokeApiService(options.apiUrl);

  const startSession = async () => {
    // Initialize audio capture
    try {
      await audioProcessor.initialize();
      console.log('[KaraokeSession] Audio processor initialized');
    } catch (error) {
      console.error('[KaraokeSession] Failed to initialize audio:', error);
    }
    
    // Create session on server if trackId provided
    console.log('[KaraokeSession] Session creation check:', {
      hasTrackId: !!options.trackId,
      hasSongData: !!options.songData,
      trackId: options.trackId,
      songData: options.songData,
      apiUrl: options.apiUrl
    });
    
    if (options.trackId && options.songData) {
      try {
        console.log('[KaraokeSession] Creating session on server...');
        const session = await karaokeApi.startSession(
          options.trackId,
          {
            title: options.songData.title,
            artist: options.songData.artist,
            duration: options.songData.duration,
            difficulty: 'intermediate', // Default difficulty
          },
          undefined, // authToken
          options.songCatalogId
        );
        
        if (session) {
          setSessionId(session.id);
          console.log('[KaraokeSession] Session created:', session.id);
        } else {
          console.error('[KaraokeSession] Failed to create session');
        }
      } catch (error) {
        console.error('[KaraokeSession] Failed to create session:', error);
      }
    } else {
      console.log('[KaraokeSession] Skipping session creation - missing trackId or songData');
    }
    
    // Start countdown
    setCountdown(3);
    
    const countdownInterval = setInterval(() => {
      const current = countdown();
      if (current !== null && current > 1) {
        setCountdown(current - 1);
      } else {
        clearInterval(countdownInterval);
        setCountdown(null);
        startPlayback();
      }
    }, 1000);
  };

  const startPlayback = () => {
    setIsPlaying(true);
    
    // Start full session audio capture
    audioProcessor.startFullSession();
    
    const audio = audioElement() || options.audioElement;
    if (audio) {
      console.log('[KaraokeSession] Starting playback with audio element');
      // If audio element is provided, use it
      audio.play().catch(console.error);
      
      const updateTime = () => {
        const time = audio.currentTime * 1000;
        setCurrentTime(time);
        
        // Check if we need to start recording for upcoming lines
        checkForUpcomingLines(time);
      };
      
      audioUpdateInterval = setInterval(updateTime, 100) as unknown as number;
      
      audio.addEventListener('ended', handleEnd);
    } else {
      console.log('[KaraokeSession] No audio element available for playback');
    }
  };
  
  const checkForUpcomingLines = (currentTimeMs: number) => {
    if (isRecording() || !options.lyrics.length) return;
    
    const recorded = recordedChunks();
    
    // Look for chunks that should start recording soon
    for (let i = 0; i < options.lyrics.length; i++) {
      // Skip if we've already recorded a chunk starting at this index
      if (recorded.has(i)) {
        continue;
      }
      
      const chunk = shouldChunkLines(options.lyrics, i);
      const firstLine = options.lyrics[chunk.startIndex];
      
      if (firstLine && firstLine.startTime !== undefined) {
        const recordingStartTime = firstLine.startTime * 1000 - 1000; // Start 1s early
        const lineStartTime = firstLine.startTime * 1000;
        
        // Check if we're in the recording window and haven't passed the line start
        if (currentTimeMs >= recordingStartTime && currentTimeMs < lineStartTime + 500) { // Allow 500ms buffer after line start
          console.log(`[KaraokeSession] Time to start recording chunk ${chunk.startIndex}-${chunk.endIndex}: ${currentTimeMs}ms is between ${recordingStartTime}ms and ${lineStartTime + 500}ms`);
          // Mark this chunk as recorded
          setRecordedChunks(prev => new Set(prev).add(chunk.startIndex));
          // Start recording this chunk
          startRecordingChunk(chunk);
          break;
        }
      }
      
      // Skip ahead to avoid checking lines we've already passed
      i = chunk.endIndex;
    }
  };
  
  const startRecordingChunk = async (chunk: ChunkInfo) => {
    console.log(`[KaraokeSession] Starting recording for chunk ${chunk.startIndex}-${chunk.endIndex}`);
    
    // TESTING MODE: Auto-complete after 5 lines
    if (chunk.startIndex >= 5) {
      console.log('[KaraokeSession] TEST MODE: Stopping after 5 lines');
      handleEnd();
      return;
    }
    
    setCurrentChunk(chunk);
    setIsRecording(true);
    
    // Start audio capture for this chunk
    audioProcessor.startRecordingLine(chunk.startIndex);
    
    // Calculate recording duration
    const duration = calculateRecordingDuration(options.lyrics, chunk);
    console.log(`[KaraokeSession] Recording duration for chunk ${chunk.startIndex}-${chunk.endIndex}: ${duration}ms`);
    
    // Stop recording after duration
    recordingTimeout = setTimeout(() => {
      stopRecordingChunk();
    }, duration) as unknown as number;
  };
  
  const stopRecordingChunk = async () => {
    const chunk = currentChunk();
    if (!chunk) return;
    
    console.log(`[KaraokeSession] Stopping recording for chunk ${chunk.startIndex}-${chunk.endIndex}`);
    setIsRecording(false);
    
    // Get the recorded audio
    const audioChunks = audioProcessor.stopRecordingLineAndGetRawAudio();
    const wavBlob = audioProcessor.convertAudioToWavBlob(audioChunks);
    
    console.log(`[KaraokeSession] Audio blob created:`, {
      hasBlob: !!wavBlob,
      blobSize: wavBlob?.size,
      chunksLength: audioChunks.length,
      hasSessionId: !!sessionId(),
      sessionId: sessionId()
    });
    
    // Check if we have enough audio data
    if (wavBlob && wavBlob.size > 1000 && sessionId()) { // Minimum 1KB of audio data
      // Convert to base64 for API
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Audio = reader.result?.toString().split(',')[1];
        if (base64Audio && base64Audio.length > 100) { // Ensure we have meaningful base64 data
          await gradeChunk(chunk, base64Audio);
        } else {
          console.warn('[KaraokeSession] Base64 audio too short, skipping grade');
        }
      };
      reader.readAsDataURL(wavBlob);
    } else if (wavBlob && wavBlob.size <= 1000) {
      console.warn('[KaraokeSession] Audio blob too small, skipping grade:', wavBlob.size, 'bytes');
      // Add a neutral score for UI feedback
      setLineScores(prev => [...prev, {
        lineIndex: chunk.startIndex,
        score: 50,
        transcription: '',
        feedback: 'Recording too short'
      }]);
    } else if (wavBlob && !sessionId()) {
      console.warn('[KaraokeSession] Have audio but no session ID - cannot grade');
    }
    
    setCurrentChunk(null);
    
    if (recordingTimeout) {
      clearTimeout(recordingTimeout);
      recordingTimeout = null;
    }
  };
  
  const gradeChunk = async (chunk: ChunkInfo, audioBase64: string) => {
    const currentSessionId = sessionId();
    console.log('[KaraokeSession] Grading chunk:', {
      hasSessionId: !!currentSessionId,
      sessionId: currentSessionId,
      chunkIndex: chunk.startIndex,
      audioLength: audioBase64.length
    });
    
    if (!currentSessionId) {
      console.warn('[KaraokeSession] No session ID, skipping grade');
      return;
    }
    
    try {
      console.log('[KaraokeSession] Sending grade request...');
      const lineScore = await karaokeApi.gradeRecording(
        currentSessionId,
        chunk.startIndex,
        audioBase64,
        chunk.expectedText,
        options.lyrics[chunk.startIndex]?.startTime || 0,
        (options.lyrics[chunk.endIndex]?.startTime || 0) + (options.lyrics[chunk.endIndex]?.duration || 0) / 1000
      );
      
      if (lineScore) {
        console.log(`[KaraokeSession] Chunk graded:`, lineScore);
        
        // Update line scores
        const newLineScore = {
          lineIndex: chunk.startIndex,
          score: lineScore.score,
          transcription: lineScore.transcript || '',
          feedback: lineScore.feedback
        };
        
        setLineScores(prev => [...prev, newLineScore]);
        
        // Update total score (simple average for now) - use prev to avoid dependency
        setScore(prev => {
          const allScores = [...lineScores(), newLineScore];
          const avgScore = allScores.reduce((sum, s) => sum + s.score, 0) / allScores.length;
          return Math.round(avgScore);
        });
        
        // Removed test mode limit
      } else {
        console.warn(`[KaraokeSession] Failed to grade chunk`);
        
        // Add a neutral score for UI feedback
        setLineScores(prev => [...prev, {
          lineIndex: chunk.startIndex,
          score: 50, // Neutral score
          transcription: '',
          feedback: 'Failed to grade recording'
        }]);
      }
    } catch (error) {
      console.error('[KaraokeSession] Failed to grade chunk:', error);
    }
  };

  const handleEnd = async () => {
    console.log('[KaraokeSession] Handling session end');
    setIsPlaying(false);
    if (audioUpdateInterval) {
      clearInterval(audioUpdateInterval);
    }
    
    // Pause the audio
    const audio = audioElement() || options.audioElement;
    if (audio && !audio.paused) {
      audio.pause();
    }
    
    // Stop any ongoing recording
    if (isRecording()) {
      await stopRecordingChunk();
    }
    
    // Show loading state immediately
    const loadingResults: KaraokeResults = {
      score: -1, // Special value to indicate loading
      accuracy: 0,
      totalLines: lineScores().length,
      perfectLines: 0,
      goodLines: 0,
      needsWorkLines: 0,
      sessionId: sessionId() || undefined,
      isLoading: true
    };
    options.onComplete?.(loadingResults);
    
    // Get full session audio
    const fullAudioBlob = audioProcessor.stopFullSessionAndGetWav();
    console.log('[KaraokeSession] Full session audio blob:', {
      hasBlob: !!fullAudioBlob,
      blobSize: fullAudioBlob?.size
    });
    
    // Complete session on server
    const currentSessionId = sessionId();
    if (currentSessionId && fullAudioBlob && fullAudioBlob.size > 1000) {
      try {
        console.log('[KaraokeSession] Converting full audio to base64...');
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Audio = reader.result?.toString().split(',')[1];
          console.log('[KaraokeSession] Sending completion request with full audio');
          
          const sessionResults = await karaokeApi.completeSession(
            currentSessionId,
            base64Audio
          );
          
          if (sessionResults) {
            console.log('[KaraokeSession] Session completed:', sessionResults);
            
            const results: KaraokeResults = {
              score: sessionResults.finalScore,
              accuracy: sessionResults.accuracy,
              totalLines: sessionResults.totalLines,
              perfectLines: sessionResults.perfectLines,
              goodLines: sessionResults.goodLines,
              needsWorkLines: sessionResults.needsWorkLines,
              sessionId: currentSessionId
            };
            
            options.onComplete?.(results);
          } else {
            console.log('[KaraokeSession] No session results, calculating locally');
            // Fallback to local calculation
            calculateLocalResults();
          }
        };
        reader.readAsDataURL(fullAudioBlob);
      } catch (error) {
        console.error('[KaraokeSession] Failed to complete session:', error);
        calculateLocalResults();
      }
    } else {
      console.log('[KaraokeSession] No session/audio, returning local results');
      // No session, just return local results
      calculateLocalResults();
    }
  };
  
  const calculateLocalResults = () => {
    console.log('[KaraokeSession] Calculating local results');
    const scores = lineScores();
    const avgScore = scores.length > 0 
      ? scores.reduce((sum, s) => sum + s.score, 0) / scores.length
      : 0;
    
    const results: KaraokeResults = {
      score: Math.round(avgScore),
      accuracy: Math.round(avgScore),
      totalLines: scores.length, // Use actual completed lines for test mode
      perfectLines: scores.filter(s => s.score >= 90).length,
      goodLines: scores.filter(s => s.score >= 70 && s.score < 90).length,
      needsWorkLines: scores.filter(s => s.score < 70).length,
      sessionId: sessionId() || undefined
    };
    
    console.log('[KaraokeSession] Local results calculated:', results);
    options.onComplete?.(results);
  };

  const stopSession = () => {
    setIsPlaying(false);
    setCountdown(null);
    setIsRecording(false);
    setCurrentChunk(null);
    setRecordedChunks(new Set<number>());
    
    if (audioUpdateInterval) {
      clearInterval(audioUpdateInterval);
      audioUpdateInterval = null;
    }
    
    if (recordingTimeout) {
      clearTimeout(recordingTimeout);
      recordingTimeout = null;
    }
    
    const audio = audioElement() || options.audioElement;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audio.removeEventListener('ended', handleEnd);
    }
    
    // Cleanup audio processor
    audioProcessor.cleanup();
  };

  onCleanup(() => {
    stopSession();
  });

  return {
    // State
    isPlaying,
    currentTime,
    score,
    countdown,
    sessionId,
    lineScores,
    isRecording,
    currentChunk,
    
    // Actions
    startSession,
    stopSession,
    
    // Audio processor (for direct access if needed)
    audioProcessor,
    
    // Method to update audio element after initialization
    setAudioElement
  };
}