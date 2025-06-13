import type { Component } from 'solid-js';
import { Show } from 'solid-js';
import { cn } from '../../../utils/cn';
import { useI18n } from '../../../i18n';

export interface ScorePanelProps {
  score: number | null;
  rank: number | null;
  backgroundImage?: string;
  class?: string;
}

export const ScorePanel: Component<ScorePanelProps> = (props) => {
  const { t, formatNumber } = useI18n();
  
  return (
    <div class={cn('relative overflow-hidden', props.class)}>
      {/* Background image with gradient overlay */}
      <Show when={props.backgroundImage || (props.score !== null && props.rank !== null)}>
        <div class="absolute inset-0 -z-10">
          <div 
            class="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{
              'background-image': props.backgroundImage 
                ? `url("${props.backgroundImage}")` 
                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              'filter': 'brightness(0.8) saturate(1.2)'
            }}
          />
          {/* Progressive gradient overlay - less opaque at top, more at bottom */}
          <div 
            class="absolute inset-0"
            style={{
              'background': 'linear-gradient(to bottom, rgba(0, 0, 0, 0.1) 0%, rgba(0, 0, 0, 0.3) 30%, rgba(0, 0, 0, 0.5) 60%, rgba(0, 0, 0, 0.8) 100%)'
            }}
          />
        </div>
      </Show>
      
      {/* Score content - positioned toward the bottom */}
      <div class="relative grid grid-cols-[1fr_1fr] gap-3 p-6 pt-12">
        {/* Score Box */}
        <div class="bg-surface/80 backdrop-blur-md rounded-lg p-4 flex flex-col items-center justify-center min-h-[100px] shadow-lg">
          <div class="text-3xl font-mono font-bold text-purple-400">
            <Show when={props.score !== null} fallback="—">
              {formatNumber(props.score!)}
            </Show>
          </div>
          <div class="text-sm text-secondary mt-1">
            {t('display.scorePanel.score')}
          </div>
        </div>
        
        {/* Rank Box */}
        <div class="bg-surface/80 backdrop-blur-md rounded-lg p-4 flex flex-col items-center justify-center min-h-[100px] shadow-lg">
          <div class="text-3xl font-mono font-bold text-pink-400">
            <Show when={props.rank !== null} fallback="—">
              #{formatNumber(props.rank!)}
            </Show>
          </div>
          <div class="text-sm text-secondary mt-1">
            {t('display.scorePanel.rank')}
          </div>
        </div>
      </div>
    </div>
  );
};