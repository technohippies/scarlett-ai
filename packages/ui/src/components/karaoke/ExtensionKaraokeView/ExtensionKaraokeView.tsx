import { Show, type Component } from 'solid-js';
import { cn } from '../../../utils/cn';
import { ScorePanel } from '../../display/ScorePanel';
import { LyricsDisplay, type LyricLine } from '../LyricsDisplay';
import { LeaderboardPanel, type LeaderboardEntry } from '../LeaderboardPanel';
import { SplitButton } from '../../common/SplitButton';
import type { PlaybackSpeed } from '../../common/SplitButton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../common/Tabs';

export interface ExtensionKaraokeViewProps {
  // Scores
  score: number;
  rank: number;
  
  // Lyrics
  lyrics: LyricLine[];
  currentTime?: number;
  
  // Leaderboard
  leaderboard: LeaderboardEntry[];
  
  // State
  isPlaying?: boolean;
  onStart?: () => void;
  onSpeedChange?: (speed: PlaybackSpeed) => void;
  
  class?: string;
}

export const ExtensionKaraokeView: Component<ExtensionKaraokeViewProps> = (props) => {
  console.log('[ExtensionKaraokeView] Rendering with props:', {
    isPlaying: props.isPlaying,
    hasOnStart: !!props.onStart,
    lyricsLength: props.lyrics?.length
  });
  
  return (
    <div class={cn('flex flex-col h-full bg-base', props.class)}>
      {/* Score Panel */}
      <ScorePanel
        score={props.score}
        rank={props.rank}
      />

      {/* Tabs and content */}
      <Tabs 
        tabs={[
          { id: 'lyrics', label: 'Lyrics' },
          { id: 'leaderboard', label: 'Leaderboard' }
        ]}
        defaultTab="lyrics"
        class="flex-1 flex flex-col min-h-0"
      >
        <div class="px-4">
          <TabsList>
            <TabsTrigger value="lyrics">Lyrics</TabsTrigger>
            <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value="lyrics" class="flex-1 min-h-0">
          {console.log('[ExtensionKaraokeView] Inside lyrics TabsContent')}
          <div class="flex flex-col h-full">
            <div class="flex-1 min-h-0 overflow-hidden">
              <LyricsDisplay
                lyrics={props.lyrics}
                currentTime={props.currentTime}
                isPlaying={props.isPlaying}
              />
            </div>
            
            {/* Footer with start button */}
            {console.log('[ExtensionKaraokeView] Start button check:', {
              isPlaying: props.isPlaying,
              notPlaying: !props.isPlaying,
              hasOnStart: !!props.onStart,
              shouldShowButton: () => !props.isPlaying && props.onStart
            })}
            <Show when={!props.isPlaying && props.onStart}>
              <div 
                class="p-4 bg-surface border-t border-subtle"
                style={{
                  'flex-shrink': '0'
                }}
              >
                {console.log('[ExtensionKaraokeView] Rendering Start button div')}
                <SplitButton
                  onStart={props.onStart}
                  onSpeedChange={props.onSpeedChange}
                />
              </div>
            </Show>
          </div>
        </TabsContent>
        
        <TabsContent value="leaderboard" class="flex-1 overflow-hidden">
          <div class="overflow-y-auto h-full">
            <LeaderboardPanel entries={props.leaderboard} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};