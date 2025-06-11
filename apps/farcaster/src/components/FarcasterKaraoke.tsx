import type { Component } from 'solid-js';
import { createSignal } from 'solid-js';
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
  const [score] = createSignal(0);
  const [rank] = createSignal(1);
  
  const {
    isPlaying,
    currentTime,
    countdown,
    startSession
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
        songTitle={props.title}
        artist={props.artist}
        score={score()}
        rank={rank()}
        lyrics={props.lyrics}
        currentTime={currentTime()}
        isPlaying={isPlaying()}
        onStart={startSession}
        leaderboard={[]}
      />
      
      {/* Shared countdown component */}
      <Countdown count={countdown()} />
    </div>
  );
};