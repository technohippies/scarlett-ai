import type { Component } from 'solid-js';
import { cn } from '../../../utils/cn';
import { useI18n } from '../../../i18n';

export interface ScorePanelProps {
  score: number | null;
  rank: number | null;
  backgroundImage?: string;
  class?: string;
}

export const ScorePanel: Component<ScorePanelProps> = (props) => {
  const { t } = useI18n();
  
  return (
    <div class={cn('relative overflow-hidden', props.class)}>
      {/* Background image with gradient overlay */}
      <div class="absolute inset-0 -z-10">
        <div 
          class="absolute inset-0 bg-cover bg-center"
          style={{
            'background-image': props.backgroundImage ? `url("${props.backgroundImage}")` : 'url("/images/score-background.jpg")',
            'filter': 'brightness(0.7)'
          }}
        />
        <div class="absolute inset-0 bg-gradient-to-b from-black/30 via-black/50 to-black/70" />
      </div>
      
      {/* Score content */}
      <div class="relative grid grid-cols-[1fr_1fr] gap-2 p-4">
        {/* Score Box */}
        <div class="bg-surface/90 backdrop-blur-sm rounded-lg p-4 flex flex-col items-center justify-center min-h-[80px]">
          <div class="text-2xl font-mono font-bold text-purple-500">
            {props.score !== null ? props.score : '—'}
          </div>
          <div class="text-sm text-secondary mt-1">
            {t('karaoke.scoring.score')}
          </div>
        </div>
        
        {/* Rank Box */}
        <div class="bg-surface/90 backdrop-blur-sm rounded-lg p-4 flex flex-col items-center justify-center min-h-[80px]">
          <div class="text-2xl font-mono font-bold text-pink-500">
            {props.rank !== null ? props.rank : '—'}
          </div>
          <div class="text-sm text-secondary mt-1">
            {t('karaoke.completion.rank')}
          </div>
        </div>
      </div>
    </div>
  );
};