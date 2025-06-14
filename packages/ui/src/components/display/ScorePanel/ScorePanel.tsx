import type { Component } from 'solid-js';
import { Show } from 'solid-js';
import { cn } from '../../../utils/cn';
import { useI18n } from '../../../i18n';

export interface ScorePanelProps {
  score: number | null;
  rank: number | null;
  backgroundImage?: string;
  title?: string;
  artist?: string;
  class?: string;
}

export const ScorePanel: Component<ScorePanelProps> = (props) => {
  const { t, formatNumber } = useI18n();
  
  return (
    <div class={cn('relative flex flex-col', props.class)} style={{ height: '40vh', 'min-height': '400px' }}>
      {/* Background image with gradient overlay - always show if backgroundImage is provided */}
      <Show when={props.backgroundImage}>
        <div class="absolute inset-0 z-0">
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
      
      {/* Spacer to push content to bottom */}
      <div class="flex-1" />
      
      {/* Content container */}
      <div class="relative z-10 px-4 pt-8 pb-8">
        {/* Title and Artist */}
        <Show when={props.title || props.artist}>
          <div class="mb-6">
            <Show when={props.title}>
              <h2 class="text-3xl font-bold text-white mb-1">{props.title}</h2>
            </Show>
            <Show when={props.artist}>
              <p class="text-xl text-white/80">{props.artist}</p>
            </Show>
          </div>
        </Show>
        
        {/* Score and Rank boxes */}
        <div class="flex gap-4 w-full">
          {/* Score Box */}
          <div class="flex-1 bg-surface/80 backdrop-blur-md rounded-lg p-4 flex flex-col items-center justify-center min-h-[100px] shadow-lg">
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
          <div class="flex-1 bg-surface/80 backdrop-blur-md rounded-lg p-4 flex flex-col items-center justify-center min-h-[100px] shadow-lg">
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
    </div>
  );
};