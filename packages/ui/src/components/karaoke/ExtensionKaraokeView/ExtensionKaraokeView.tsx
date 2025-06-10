import type { Component } from 'solid-js';
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
        class="flex-1 flex flex-col overflow-hidden"
      >
        <div class="px-4">
          <TabsList>
            <TabsTrigger value="lyrics">Lyrics</TabsTrigger>
            <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value="lyrics" class="flex-1 flex flex-col overflow-hidden">
          <div class="flex-1 overflow-hidden">
            <LyricsDisplay
              lyrics={props.lyrics}
              currentTime={props.currentTime}
              isPlaying={props.isPlaying}
            />
          </div>
          
          {/* Footer with start button */}
          {!props.isPlaying && props.onStart && (
            <div class="p-4 bg-surface border-t border-subtle">
              <SplitButton
                onStart={props.onStart}
                onSpeedChange={props.onSpeedChange}
              />
            </div>
          )}
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