import type { Component } from 'solid-js';
import { cn } from '../../../utils/cn';
import { useI18n } from '../../../i18n';

export interface ScorePanelProps {
  score: number | null;
  rank: number | null;
  class?: string;
}

export const ScorePanel: Component<ScorePanelProps> = (props) => {
  const { t } = useI18n();
  
  return (
    <div class={cn('grid grid-cols-[1fr_1fr] gap-2 p-4', props.class)}>
      {/* Score Box */}
      <div class="bg-surface rounded-lg p-4 flex flex-col items-center justify-center min-h-[80px]">
        <div class="text-2xl font-mono font-bold text-purple-500">
          {props.score !== null ? props.score : '—'}
        </div>
        <div class="text-sm text-secondary mt-1">
          {t('karaoke.scoring.score')}
        </div>
      </div>
      
      {/* Rank Box */}
      <div class="bg-surface rounded-lg p-4 flex flex-col items-center justify-center min-h-[80px]">
        <div class="text-2xl font-mono font-bold text-pink-500">
          {props.rank !== null ? props.rank : '—'}
        </div>
        <div class="text-sm text-secondary mt-1">
          {t('karaoke.completion.rank')}
        </div>
      </div>
    </div>
  );
};