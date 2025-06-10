import { Show, createMemo } from 'solid-js';
import type { Component } from 'solid-js';
import { cn } from '../../../utils/cn';
import type { PlaybackSpeed } from '../../common/SplitButton';
import { useI18n } from '../../../i18n';

export interface CompletionViewProps {
  score: number;
  rank: number;
  speed: PlaybackSpeed;
  feedbackText?: string;
  onPractice?: () => void;
  class?: string;
}

export const CompletionView: Component<CompletionViewProps> = (props) => {
  const { t, formatNumber } = useI18n();
  
  // Get feedback text based on score
  const getFeedbackText = createMemo(() => {
    if (props.feedbackText) return props.feedbackText;
    
    if (props.score >= 95) return t('karaoke.scoring.perfect');
    if (props.score >= 85) return t('karaoke.scoring.excellent');
    if (props.score >= 70) return t('karaoke.scoring.great');
    if (props.score >= 50) return t('karaoke.scoring.good');
    return t('karaoke.scoring.keepPracticing');
  });
  
  return (
    <div class={cn('flex flex-col items-center justify-center min-h-screen p-6 bg-base', props.class)}>
      {/* Score */}
      <div class="text-7xl font-mono font-bold text-accent-primary mb-3">
        {formatNumber(props.score)}
      </div>
      <div class="text-lg text-secondary mb-10">{t('karaoke.scoring.score')}</div>
      
      {/* Stats row */}
      <div class="flex gap-12 mb-12">
        {/* Rank */}
        <div class="text-center">
          <div class="text-3xl font-bold text-primary mb-2">#{formatNumber(props.rank)}</div>
          <div class="text-lg text-secondary">Rank</div>
        </div>
        
        {/* Speed */}
        <div class="text-center">
          <div class="text-3xl font-bold text-primary mb-2">{props.speed}</div>
          <div class="text-lg text-secondary">{t('common.speed.label')}</div>
        </div>
      </div>
      
      {/* Feedback text */}
      <div class="max-w-md text-center">
        <p class="text-xl text-primary leading-relaxed">
          {getFeedbackText()}
        </p>
      </div>
      
      {/* Practice button - positioned at bottom */}
      <Show when={props.onPractice}>
        <div class="absolute bottom-0 left-0 right-0 p-6">
          <button
            onClick={props.onPractice}
            class="w-full bg-accent py-4 px-6 rounded-full text-lg font-semibold text-white hover:bg-accent-hover transition-colors duration-200 shadow-lg"
          >
            Practice Errors
          </button>
        </div>
      </Show>
    </div>
  );
};