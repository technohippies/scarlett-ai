import type { Component } from 'solid-js';
import { cn } from '../../../utils/cn';
import { KaraokeHeader } from '../KaraokeHeader';
import { ScorePanel } from '../../display/ScorePanel';
import { LyricsDisplay, type LyricLine } from '../LyricsDisplay';
import { LeaderboardPanel, type LeaderboardEntry } from '../LeaderboardPanel';
import { SplitButton } from '../../common/SplitButton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../common/Tabs';
import { useI18n } from '../../../i18n';

export interface FarcasterKaraokeViewProps {
  // Song info
  songTitle: string;
  artist: string;
  artworkUrl?: string;
  
  // Scores
  score: number | null;
  rank: number | null;
  lineScores?: number[];
  
  // Lyrics
  lyrics: LyricLine[];
  currentTime?: number;
  
  // Leaderboard
  leaderboard: LeaderboardEntry[];
  
  // State
  isPlaying?: boolean;
  onStart?: () => void;
  onBack?: () => void;
  onLyricClick?: (lyric: LyricLine, index: number) => void;
  
  class?: string;
}

export const FarcasterKaraokeView: Component<FarcasterKaraokeViewProps> = (props) => {
  const { t } = useI18n();
  
  return (
    <div class={cn('flex flex-col h-screen overflow-hidden bg-base relative', props.class)}>
      {/* Back button - positioned absolutely */}
      <button
        onClick={props.onBack}
        class="absolute top-4 left-4 z-50 p-2 text-white drop-shadow-lg hover:text-white/90 transition-colors"
        aria-label={t('karaoke.controls.goBack')}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-6 h-6">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      
      {/* Score Panel - only show when not playing */}
      {!props.isPlaying && (
        <ScorePanel
          score={props.score}
          rank={props.rank}
          backgroundImage={props.artworkUrl}
          title={props.songTitle}
          artist={props.artist}
        />
      )}

      {/* Tabs and content - hide tab switcher when playing */}
      <Tabs 
        tabs={[
          { id: 'lyrics', label: 'Lyrics' },
          { id: 'leaderboard', label: 'Leaderboard' }
        ]}
        defaultTab="lyrics"
        class="flex-1 flex flex-col min-h-0"
      >
        {!props.isPlaying && (
          <div class="px-4">
            <TabsList>
              <TabsTrigger value="lyrics">{t('karaoke.tabs.lyrics')}</TabsTrigger>
              <TabsTrigger value="leaderboard">{t('karaoke.tabs.leaderboard')}</TabsTrigger>
            </TabsList>
          </div>
        )}
        
        <TabsContent value="lyrics" class="flex-1 flex flex-col min-h-0">
          <div class="flex-1 overflow-y-auto">
            <LyricsDisplay
              lyrics={props.lyrics}
              currentTime={props.currentTime}
              isPlaying={props.isPlaying}
              lineScores={props.lineScores}
              onLyricClick={props.onLyricClick}
            />
          </div>
          
          {/* Footer with start button */}
          {!props.isPlaying && props.onStart && (
            <div class="p-4 bg-surface border-t border-subtle">
              <SplitButton
                onStart={props.onStart}
              />
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="leaderboard" class="flex-1 min-h-0">
          <div class="overflow-y-auto h-full">
            <LeaderboardPanel entries={props.leaderboard} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};