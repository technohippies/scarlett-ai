import { Component, createSignal, onMount } from 'solid-js';
import { 
  FarcasterKaraokeView, 
  Countdown, 
  useKaraokeSession, 
  WebAudioService,
  type LyricLine 
} from '@scarlett/ui';

interface FarcasterKaraokeProps {
  songUrl: string;
  lyrics: LyricLine[];
  trackId: string;
  title: string;
  artist: string;
}

export const FarcasterKaraoke: Component<FarcasterKaraokeProps> = (props) => {
  const audioService = new WebAudioService(props.songUrl);
  
  const {
    isPlaying,
    currentTime,
    score,
    countdown,
    startSession,
    stopSession
  } = useKaraokeSession({
    lyrics: props.lyrics,
    audioElement: audioService.findAudioElement(),
    onComplete: (results) => {
      console.log('Karaoke completed:', results);
      // Handle completion - save score, show share dialog, etc.
    }
  });

  return (
    <div class="relative h-full">
      <FarcasterKaraokeView
        track={{
          trackId: props.trackId,
          title: props.title,
          artist: props.artist,
          platform: 'farcaster',
          url: ''
        }}
        lyrics={props.lyrics}
        currentTime={currentTime()}
        isPlaying={isPlaying()}
        onStart={startSession}
      />
      
      {/* Shared countdown component */}
      <Countdown count={countdown()} />
    </div>
  );
};