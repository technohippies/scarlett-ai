import { Show, createMemo } from 'solid-js';
import type { Component } from 'solid-js';
import { cn } from '../../../utils/cn';
import type { PlaybackSpeed } from '../../common/SplitButton';
import { Button } from '../../common/Button';
import { useI18n } from '../../../i18n';
import { AnimatedNumber } from '../../effects/AnimatedNumber';

export interface CompletionViewProps {
  score: number;
  rank: number;
  speed: PlaybackSpeed;
  feedbackText?: string;
  onPractice?: () => void;
  currentStreak?: number;
  previousStreak?: number;
  isNewStreak?: boolean;
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
    <div class={cn('flex flex-col h-full bg-base', props.class)}>
      {/* Main content area */}
      <div class="flex-1 flex flex-col items-center justify-center p-6">
        {/* Score */}
        <div class="text-center flex flex-col mb-10">
          <div class="text-lg text-secondary mb-3 order-1">{t('karaoke.scoring.score')}</div>
          <div class="text-7xl font-mono font-bold text-accent-primary order-2">
            {formatNumber(props.score)}
          </div>
        </div>
        
        {/* Stats row */}
        <div class="flex gap-12 mb-12">
          {/* Rank */}
          <div class="text-center flex flex-col">
            <div class="text-lg text-secondary mb-2 order-1">Rank</div>
            <div class="text-3xl font-bold text-primary order-2">#{formatNumber(props.rank)}</div>
          </div>
          
          {/* Streak */}
          <Show when={props.currentStreak !== undefined}>
            <div class="text-center flex flex-col">
              <div class="text-lg text-secondary mb-2 order-1 flex items-center justify-center gap-1">
                <span>Streak</span>
                <Show when={props.isNewStreak}>
                  <span class="text-accent-primary">🔥</span>
                </Show>
              </div>
              <div class="text-3xl font-bold text-primary order-2">
                <AnimatedNumber 
                  value={props.currentStreak || 0}
                  duration={props.isNewStreak ? 1200 : 0}
                />
              </div>
            </div>
          </Show>
          
          {/* Speed */}
          <div class="text-center flex flex-col">
            <div class="text-lg text-secondary mb-2 order-1">{t('common.speed.label')}</div>
            <div class="text-3xl font-bold text-primary order-2">{props.speed}</div>
          </div>
        </div>
        
        {/* Feedback text */}
        <div class="max-w-md text-center">
          <p class="text-xl text-primary leading-relaxed">
            {getFeedbackText()}
          </p>
        </div>
      </div>
      
      {/* Footer with practice button - positioned at bottom of widget */}
      <Show when={props.onPractice}>
        <div class="p-4 bg-surface border-t border-subtle">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={props.onPractice}
          >
            Practice Errors
          </Button>
        </div>
      </Show>
    </div>
  );
};