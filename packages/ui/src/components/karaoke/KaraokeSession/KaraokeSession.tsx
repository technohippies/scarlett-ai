import { createEffect, createSignal, onMount, onCleanup, Show } from 'solid-js';
import type { Component } from 'solid-js';
import { createKaraokeAudioProcessor } from '../../../services/audio/karaokeAudioProcessor';
import { createKaraokeStore } from '../../../stores/karaokeStore';
import { KaraokeApiService } from '../../../services/karaoke/karaokeApi';
import { shouldChunkLines, calculateRecordingDuration } from '../../../services/karaoke/chunkingUtils';
import { LyricsDisplay } from '../LyricsDisplay';
import { KaraokeCompletion } from '../KaraokeCompletion';
import type { SessionResults } from '../../../types/karaoke';

export interface KaraokeSessionProps {
  trackId: string;
  trackTitle?: string;
  artist?: string;
  authToken?: string;
  onComplete?: (results: SessionResults) => void;
}

export const KaraokeSession: Component<KaraokeSessionProps> = (props) => {
  const audioProcessor = createKaraokeAudioProcessor();
  const store = createKaraokeStore();
  const karaokeApi = new KaraokeApiService();
  
  const [currentAudioTime, setCurrentAudioTime] = createSignal(0);
  const [isAudioPlaying, setIsAudioPlaying] = createSignal(false);
  const [countdownSeconds, setCountdownSeconds] = createSignal<number | undefined>();
  const [showCompletion, setShowCompletion] = createSignal(false);
  const [isAnalyzing, setIsAnalyzing] = createSignal(false);
  const [sessionResults, setSessionResults] = createSignal<SessionResults | null>(null);
  const [userBestScore, setUserBestScore] = createSignal<number | undefined>();
  const [isNewBestScore, setIsNewBestScore] = createSignal(false);
  const [message, setMessage] = createSignal('');
  
  const getAudioElement = (): HTMLAudioElement | null => {
    return document.querySelector('#track');
  };
  
  const connectToServer = async () => {
    if (store.connectionStatus() === 'connecting' || store.connectionStatus() === 'connected') {
      return;
    }
    
    store.setConnectionStatus('connecting');
    setMessage('');
    
    try {
      const data = await karaokeApi.fetchKaraokeData(props.trackId, props.trackTitle, props.artist);
      
      if (data) {
        store.setKaraokeData(data);
        
        if (data.has_karaoke && data.song && data.lyrics?.type === 'synced') {
          const hasTimedLyrics = data.lyrics.lines.some(line => line.timestamp !== null);
          
          if (hasTimedLyrics) {
            store.setConnectionStatus('connected');
            console.log('[KaraokeSession] Karaoke data loaded:', data);
            
            if (data.song.genius_id && props.authToken) {
              const bestScore = await karaokeApi.getUserBestScore(data.song.genius_id, props.authToken);
              if (bestScore !== null) {
                setUserBestScore(bestScore);
              }
            }
          } else {
            store.setConnectionStatus('no-karaoke');
            setMessage('This track has lyrics but no synchronized timing for karaoke.');
          }
        } else {
          store.setConnectionStatus('no-karaoke');
          setMessage('No karaoke available for this track.');
        }
      } else {
        throw new Error('Failed to fetch karaoke data');
      }
    } catch (error) {
      console.error('[KaraokeSession] Failed to connect:', error);
      store.setConnectionStatus('disconnected');
      setMessage('Failed to connect to server');
    }
  };
  
  const handleStartKaraoke = () => {
    setCountdownSeconds(3);
    
    let count = 3;
    const countdownInterval = setInterval(() => {
      count--;
      
      if (count <= 0) {
        clearInterval(countdownInterval);
        setCountdownSeconds(undefined);
        store.setIsKaraokeActive(true);
        startKaraokeSession();
      } else {
        setCountdownSeconds(count);
      }
    }, 1000);
  };
  
  const startKaraokeSession = async () => {
    const data = store.karaokeData();
    if (!data || !data.song || !props.authToken) return;
    
    if (!audioProcessor.isReady()) {
      await audioProcessor.initialize();
    }
    
    audioProcessor.startFullSession();
    console.log('[KaraokeSession] Started full session recording');
    
    const audio = getAudioElement();
    
    try {
      const session = await karaokeApi.startSession(
        props.trackId,
        {
          title: data.song.title,
          artist: data.song.artist,
          genius_id: data.song.genius_id,
        },
        props.authToken
      );
      
      if (session) {
        store.setCurrentSession(session);
        store.resetScoring();
        
        if (audio && data.song.start_time) {
          audio.currentTime = data.song.start_time;
        }
        
        if (audio && audio.paused) {
          try {
            await audio.play();
          } catch (error) {
            console.error('[KaraokeSession] Error auto-playing audio:', error);
          }
        }
        
        console.log('[KaraokeSession] Session started:', session);
      }
    } catch (error) {
      console.error('[KaraokeSession] Error starting session:', error);
      setMessage('Failed to start karaoke. Please try again.');
      store.setIsKaraokeActive(false);
    }
  };
  
  const handleStartRecording = async (lineIndex: number) => {
    if (store.isRecording() || !audioProcessor.isReady() || !props.authToken) return;
    
    store.setCurrentRecordingLine(lineIndex);
    store.setIsRecording(true);
    
    try {
      const data = store.karaokeData();
      const lines = data?.lyrics?.lines || [];
      const line = lines[lineIndex];
      
      const chunkInfo = shouldChunkLines(lines, lineIndex);
      const isChunked = chunkInfo.endIndex > lineIndex;
      
      if (isChunked) {
        console.log(
          `[KaraokeSession] Chunking lines ${lineIndex}-${chunkInfo.endIndex} (${chunkInfo.wordCount} words)`
        );
      }
      
      const lineDuration = calculateRecordingDuration(lines, chunkInfo);
      
      console.log(
        '[KaraokeSession] Starting recording for line:',
        lineIndex,
        'Duration:',
        lineDuration + 'ms'
      );
      
      audioProcessor.startRecordingLine(lineIndex);
      
      if (!audioProcessor.isListening()) {
        audioProcessor.startListening();
      }
      
      setTimeout(async () => {
        console.log('[KaraokeSession] Auto-stopping recording for line:', lineIndex);
        const audioChunks = audioProcessor.stopRecordingLineAndGetRawAudio();
        
        if (audioChunks.length > 0) {
          const wavBlob = audioProcessor.convertAudioToWavBlob(audioChunks);
          
          if (wavBlob) {
            const arrayBuffer = await wavBlob.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            let binaryString = '';
            const chunkSize = 1024;
            for (let i = 0; i < uint8Array.length; i += chunkSize) {
              const chunk = uint8Array.slice(i, i + chunkSize);
              binaryString += String.fromCharCode(...chunk);
            }
            const audioData = btoa(binaryString);
            
            await submitRecording(
              lineIndex,
              audioData,
              isChunked ? chunkInfo.expectedText : undefined
            );
            
            if (isChunked) {
              for (let i = lineIndex + 1; i <= chunkInfo.endIndex; i++) {
                const mainScore = store.lineScores().get(lineIndex);
                if (mainScore) {
                  store.updateLineScore(i, mainScore);
                }
              }
            }
          }
        }
        
        store.setIsRecording(false);
        store.setCurrentRecordingLine(undefined);
      }, lineDuration + 500);
    } catch (error) {
      console.error('[KaraokeSession] Recording failed:', error);
      store.setIsRecording(false);
    }
  };
  
  const submitRecording = async (
    lineIndex: number,
    audioData: string,
    chunkedText?: string
  ) => {
    const session = store.currentSession();
    const data = store.karaokeData();
    if (!session || !data?.lyrics?.lines[lineIndex] || !props.authToken) return;
    
    try {
      const score = await karaokeApi.gradeRecording(
        session.session_id,
        lineIndex,
        audioData,
        chunkedText || data.lyrics.lines[lineIndex].text,
        (store.lineScores().get(lineIndex)?.attempts || 0) + 1,
        props.authToken
      );
      
      if (score) {
        store.updateLineScore(lineIndex, score);
        console.log('[KaraokeSession] Line scored:', score);
      }
    } catch (error) {
      console.error('[KaraokeSession] Failed to submit recording:', error);
    }
  };
  
  const triggerSessionCompletion = async () => {
    console.log('[KaraokeSession] Completing session...');
    
    const audio = getAudioElement();
    if (audio) {
      audio.pause();
    }
    
    store.setIsKaraokeActive(false);
    
    const sessionWav = audioProcessor.stopFullSessionAndGetWav();
    if (!sessionWav || !props.authToken) {
      console.error('[KaraokeSession] No session audio or auth token');
      return;
    }
    
    setIsAnalyzing(true);
    setShowCompletion(true);
    
    try {
      const reader = new FileReader();
      const audioBase64 = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const base64 = reader.result as string;
          resolve(base64.split(',')[1] || '');
        };
        reader.onerror = reject;
        reader.readAsDataURL(sessionWav);
      });
      
      const data = store.karaokeData();
      const session = store.currentSession();
      
      if (!session) {
        console.error('[KaraokeSession] No active session');
        return;
      }
      
      const results = await karaokeApi.completeSession(
        session.session_id,
        audioBase64,
        data?.lyrics?.lines || [],
        props.authToken
      );
      
      if (results) {
        setSessionResults(results);
        
        const sessionScore = store.totalScore();
        const currentBestScore = userBestScore() || 0;
        
        if (sessionScore > currentBestScore) {
          setUserBestScore(sessionScore);
          setIsNewBestScore(true);
        }
        
        props.onComplete?.(results);
      }
    } catch (error) {
      console.error('[KaraokeSession] Error completing session:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  const handleRetryKaraoke = () => {
    setShowCompletion(false);
    setSessionResults(null);
    setIsNewBestScore(false);
    store.resetScoring();
    store.setIsKaraokeActive(false);
    handleStartKaraoke();
  };
  
  createEffect(() => {
    if (!store.isKaraokeActive() || !isAudioPlaying() || store.isRecording()) return;
    
    const data = store.karaokeData();
    if (!data?.lyrics?.lines) return;
    
    const currentTime = currentAudioTime();
    const currentRecording = store.currentRecordingLine();
    
    let lineToRecord: number | undefined;
    
    for (let i = 0; i < data.lyrics.lines.length; i++) {
      const line = data.lyrics.lines[i];
      if (!line) continue;
      
      const recordingStart = line.recordingStart || line.timestamp - 300;
      const nextLine = data.lyrics.lines[i + 1];
      const recordingEnd = line.recordingEnd || 
        (nextLine?.timestamp ? nextLine.timestamp - 200 : undefined) ||
        (line.timestamp + Math.min(line.duration || 3000, 5000));
      
      if (currentTime >= recordingStart && currentTime < recordingEnd) {
        lineToRecord = i;
        break;
      }
    }
    
    if (
      lineToRecord !== undefined &&
      currentRecording !== lineToRecord &&
      !store.lineScores().has(lineToRecord)
    ) {
      handleStartRecording(lineToRecord);
    }
  });
  
  onMount(async () => {
    await connectToServer();
    
    const audio = getAudioElement();
    if (!audio) return;
    
    const updateTime = () => {
      setCurrentAudioTime(audio.currentTime * 1000);
      setIsAudioPlaying(!audio.paused);
    };
    
    const handleTimeUpdate = () => updateTime();
    const handlePlay = () => setIsAudioPlaying(true);
    const handlePause = () => setIsAudioPlaying(false);
    const handleEnded = () => {
      if (store.isKaraokeActive()) {
        triggerSessionCompletion();
      }
    };
    
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    
    updateTime();
    
    onCleanup(() => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
    });
  });
  
  return (
    <Show
      when={!showCompletion()}
      fallback={
        <KaraokeCompletion
          overallScore={sessionResults()?.overallScore || store.totalScore()}
          song={{
            title: store.karaokeData()?.song?.title || props.trackTitle || 'Unknown',
            artist: store.karaokeData()?.song?.artist || props.artist || 'Unknown',
          }}
          lineResults={sessionResults()?.lineResults || []}
          isAnalyzing={isAnalyzing()}
          isNewBestScore={isNewBestScore()}
          onTryAgain={handleRetryKaraoke}
        />
      }
    >
      <LyricsDisplay
        lyrics={store.karaokeData()?.lyrics?.lines.map((line, index) => ({
          id: `line-${index}`,
          text: line.text,
          startTime: line.timestamp,
          duration: line.duration || 3000,
        })) || []}
        currentTime={currentAudioTime()}
        isPlaying={isAudioPlaying()}
      />
    </Show>
  );
};