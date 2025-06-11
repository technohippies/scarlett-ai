import type { Component } from 'solid-js';
import { cn } from '../../../utils/cn';
import { KaraokeHeader } from '../KaraokeHeader';
import { ScorePanel } from '../../display/ScorePanel';
import { LyricsDisplay, type LyricLine } from '../LyricsDisplay';
import { LeaderboardPanel, type LeaderboardEntry } from '../LeaderboardPanel';
import { SplitButton } from '../../common/SplitButton';
import type { PlaybackSpeed } from '../../common/SplitButton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../common/Tabs';

export interface FarcasterKaraokeViewProps {
  // Song info
  songTitle: string;
  artist: string;
  
  // Scores
  score: number;
  rank: number;
  lineScores?: number[];
  
  // Lyrics
  lyrics: LyricLine[];
  currentTime?: number;
  
  // Leaderboard
  leaderboard: LeaderboardEntry[];
  
  // State
  isPlaying?: boolean;
  onStart?: () => void;
  onSpeedChange?: (speed: PlaybackSpeed) => void;
  onBack?: () => void;
  
  class?: string;
}

export const FarcasterKaraokeView: Component<FarcasterKaraokeViewProps> = (props) => {
  return (
    <div class={cn('flex flex-col h-full bg-base', props.class)}>
      {/* Header with back button and song info */}
      <KaraokeHeader
        songTitle={props.songTitle}
        artist={props.artist}
        onBack={props.onBack}
        isPlaying={props.isPlaying}
        class="border-b border-subtle"
      />
      
      {/* Score Panel - only show when not playing */}
      {!props.isPlaying && (
        <ScorePanel
          score={props.score}
          rank={props.rank}
        />
      )}

      {/* Tabs and content - hide tab switcher when playing */}
      <Tabs 
        tabs={[
          { id: 'lyrics', label: 'Lyrics' },
          { id: 'leaderboard', label: 'Leaderboard' }
        ]}
        defaultTab="lyrics"
        class="flex-1 flex flex-col overflow-hidden"
      >
        {!props.isPlaying && (
          <div class="px-4">
            <TabsList>
              <TabsTrigger value="lyrics">Lyrics</TabsTrigger>
              <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
            </TabsList>
          </div>
        )}
        
        <TabsContent value="lyrics" class="flex-1 flex flex-col overflow-hidden">
          <div class="flex-1 overflow-hidden">
            <LyricsDisplay
              lyrics={props.lyrics}
              currentTime={props.currentTime}
              isPlaying={props.isPlaying}
              lineScores={props.lineScores}
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