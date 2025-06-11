import { createSignal, createEffect, onCleanup } from 'solid-js';
import type { LyricLine } from '../components/karaoke/LyricsDisplay';
import { createKaraokeAudioProcessor } from '../services/audio/karaokeAudioProcessor';
import { shouldChunkLines, calculateRecordingDuration } from '../services/karaoke/chunkingUtils';
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
  
  let audioUpdateInterval: number | null = null;
  let recordingTimeout: number | null = null;
  
  const audioProcessor = createKaraokeAudioProcessor({
    sampleRate: 16000
  });
  
  const apiUrl = options.apiUrl || 'http://localhost:3000/api';

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
      apiUrl
    });
    
    if (options.trackId && options.songData) {
      try {
        console.log('[KaraokeSession] Creating session on server...');
        const response = await fetch(`${apiUrl}/karaoke/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trackId: options.trackId,
            songData: options.songData
          })
        });
        
        console.log('[KaraokeSession] Session response:', response.status, response.statusText);
        
        if (response.ok) {
          const data = await response.json();
          setSessionId(data.session.id);
          console.log('[KaraokeSession] Session created:', data.session.id);
        } else {
          const errorText = await response.text();
          console.error('[KaraokeSession] Failed to create session:', response.status, errorText);
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
      
      audioUpdateInterval = setInterval(updateTime, 100);
      
      audio.addEventListener('ended', handleEnd);
    } else {
      console.log('[KaraokeSession] No audio element available for playback');
    }
  };
  
  const checkForUpcomingLines = (currentTimeMs: number) => {
    if (isRecording() || !options.lyrics.length) return;
    
    // Look for chunks that should start recording soon
    for (let i = 0; i < options.lyrics.length; i++) {
      const chunk = shouldChunkLines(options.lyrics, i);
      const firstLine = options.lyrics[chunk.startIndex];
      
      if (firstLine && firstLine.startTime !== undefined) {
        const recordingStartTime = firstLine.startTime * 1000 - 1000; // Start 1s early
        
        if (currentTimeMs >= recordingStartTime && currentTimeMs < firstLine.startTime * 1000) {
          console.log(`[KaraokeSession] Time to start recording chunk ${i}: ${currentTimeMs}ms >= ${recordingStartTime}ms`);
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
    setCurrentChunk(chunk);
    setIsRecording(true);
    
    // Start audio capture for this chunk
    audioProcessor.startRecordingLine(chunk.startIndex);
    
    // Calculate recording duration
    const duration = calculateRecordingDuration(options.lyrics, chunk);
    
    // Stop recording after duration
    recordingTimeout = setTimeout(() => {
      stopRecordingChunk();
    }, duration);
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
      hasSessionId: !!sessionId(),
      sessionId: sessionId()
    });
    
    if (wavBlob && sessionId()) {
      // Convert to base64 for API
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Audio = reader.result?.toString().split(',')[1];
        if (base64Audio) {
          await gradeChunk(chunk, base64Audio);
        }
      };
      reader.readAsDataURL(wavBlob);
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
      const response = await fetch(`${apiUrl}/karaoke/grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionId(),
          lineIndex: chunk.startIndex,
          audioBuffer: audioBase64,
          expectedText: chunk.expectedText,
          startTime: options.lyrics[chunk.startIndex]?.startTime || 0,
          endTime: options.lyrics[chunk.endIndex]?.endTime || 0
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`[KaraokeSession] Chunk graded:`, data);
        
        // Update line scores
        setLineScores(prev => [...prev, {
          lineIndex: chunk.startIndex,
          score: data.score,
          transcription: data.transcription,
          feedback: data.feedback
        }]);
        
        // Update total score (simple average for now)
        const scores = [...lineScores(), { lineIndex: chunk.startIndex, score: data.score, transcription: data.transcription }];
        const avgScore = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;
        setScore(Math.round(avgScore));
      }
    } catch (error) {
      console.error('[KaraokeSession] Failed to grade chunk:', error);
    }
  };

  const handleEnd = async () => {
    setIsPlaying(false);
    if (audioUpdateInterval) {
      clearInterval(audioUpdateInterval);
    }
    
    // Stop any ongoing recording
    if (isRecording()) {
      stopRecordingChunk();
    }
    
    // Get full session audio
    const fullAudioBlob = audioProcessor.stopFullSessionAndGetWav();
    
    // Complete session on server
    if (sessionId() && fullAudioBlob) {
      try {
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Audio = reader.result?.toString().split(',')[1];
          
          const response = await fetch(`${apiUrl}/karaoke/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: sessionId(),
              fullAudioBuffer: base64Audio
            })
          });
          
          if (response.ok) {
            const data = await response.json();
            console.log('[KaraokeSession] Session completed:', data);
            
            const results: KaraokeResults = {
              score: data.finalScore,
              accuracy: data.accuracy,
              totalLines: data.totalLines,
              perfectLines: data.perfectLines,
              goodLines: data.goodLines,
              needsWorkLines: data.needsWorkLines,
              sessionId: sessionId() || undefined
            };
            
            options.onComplete?.(results);
          }
        };
        reader.readAsDataURL(fullAudioBlob);
      } catch (error) {
        console.error('[KaraokeSession] Failed to complete session:', error);
        
        // Fallback to local calculation
        const scores = lineScores();
        const avgScore = scores.length > 0 
          ? scores.reduce((sum, s) => sum + s.score, 0) / scores.length
          : 0;
        
        const results: KaraokeResults = {
          score: Math.round(avgScore),
          accuracy: Math.round(avgScore),
          totalLines: options.lyrics.length,
          perfectLines: scores.filter(s => s.score >= 90).length,
          goodLines: scores.filter(s => s.score >= 70 && s.score < 90).length,
          needsWorkLines: scores.filter(s => s.score < 70).length,
          sessionId: sessionId() || undefined
        };
        
        options.onComplete?.(results);
      }
    } else {
      // No session, just return local results
      const scores = lineScores();
      const avgScore = scores.length > 0 
        ? scores.reduce((sum, s) => sum + s.score, 0) / scores.length
        : 0;
      
      const results: KaraokeResults = {
        score: Math.round(avgScore),
        accuracy: Math.round(avgScore),
        totalLines: options.lyrics.length,
        perfectLines: scores.filter(s => s.score >= 90).length,
        goodLines: scores.filter(s => s.score >= 70 && s.score < 90).length,
        needsWorkLines: scores.filter(s => s.score < 70).length
      };
      
      options.onComplete?.(results);
    }
  };

  const stopSession = () => {
    setIsPlaying(false);
    setCountdown(null);
    setIsRecording(false);
    setCurrentChunk(null);
    
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