import { createSignal, createEffect, Show } from 'solid-js';
import type { Component, JSX } from 'solid-js';
import { cn } from '../../../utils/cn';

export interface ScoreDisplayProps {
  score: number;
  maxScore?: number;
  variant?: 'default' | 'large' | 'compact' | 'animated';
  showPercentage?: boolean;
  showGrade?: boolean;
  animate?: boolean;
  prefix?: string;
  suffix?: string;
  class?: string;
}

const getGrade = (percentage: number): { grade: string; color: string } => {
  if (percentage >= 95) return { grade: 'S', color: 'text-yellow-400' };
  if (percentage >= 90) return { grade: 'A+', color: 'text-accent' };
  if (percentage >= 85) return { grade: 'A', color: 'text-accent' };
  if (percentage >= 80) return { grade: 'B+', color: 'text-emerald-400' };
  if (percentage >= 75) return { grade: 'B', color: 'text-emerald-400' };
  if (percentage >= 70) return { grade: 'C+', color: 'text-blue-400' };
  if (percentage >= 65) return { grade: 'C', color: 'text-blue-400' };
  if (percentage >= 60) return { grade: 'D', color: 'text-orange-400' };
  return { grade: 'F', color: 'text-red-400' };
};

export const ScoreDisplay: Component<ScoreDisplayProps> = (props) => {
  const [displayScore, setDisplayScore] = createSignal(props.animate ? 0 : props.score);
  const variant = () => props.variant || 'default';
  const maxScore = () => props.maxScore || 100;
  const percentage = () => Math.round((displayScore() / maxScore()) * 100);
  const gradeInfo = () => getGrade(percentage());

  createEffect(() => {
    if (props.animate) {
      const duration = 1500;
      const start = displayScore();
      const end = props.score;
      const startTime = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Easing function for smooth animation
        const eased = 1 - Math.pow(1 - progress, 3);
        
        setDisplayScore(Math.round(start + (end - start) * eased));

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      requestAnimationFrame(animate);
    } else {
      setDisplayScore(props.score);
    }
  });

  return (
    <div
      class={cn(
        'score-display',
        {
          // Variants
          'text-center': variant() === 'default' || variant() === 'large',
          'inline-flex items-center gap-2': variant() === 'compact',
        },
        props.class
      )}
    >
      {/* Score value */}
      <div
        class={cn(
          'font-bold tabular-nums',
          {
            'text-4xl': variant() === 'default',
            'text-6xl': variant() === 'large',
            'text-2xl': variant() === 'compact',
            'text-5xl': variant() === 'animated',
          },
          variant() === 'animated' && 'bg-gradient-primary bg-clip-text text-transparent'
        )}
      >
        <Show when={props.prefix}>
          <span class="text-secondary text-[0.7em] font-normal">{props.prefix}</span>
        </Show>
        
        {displayScore()}
        
        <Show when={props.maxScore}>
          <span class="text-secondary text-[0.6em] font-normal">/{maxScore()}</span>
        </Show>
        
        <Show when={props.suffix}>
          <span class="text-secondary text-[0.7em] font-normal">{props.suffix}</span>
        </Show>
      </div>

      {/* Additional info */}
      <Show when={variant() !== 'compact' && (props.showPercentage || props.showGrade)}>
        <div class="mt-2 flex items-center justify-center gap-4">
          <Show when={props.showPercentage}>
            <div class="text-lg text-secondary">
              {percentage()}%
            </div>
          </Show>

          <Show when={props.showGrade}>
            <div class={cn('text-2xl font-bold', gradeInfo().color)}>
              {gradeInfo().grade}
            </div>
          </Show>
        </div>
      </Show>

      {/* Animated variant effects */}
      <Show when={variant() === 'animated' && props.animate}>
        <div class="mt-4 flex justify-center">
          <div class="h-2 w-48 bg-surface rounded-full overflow-hidden">
            <div
              class="h-full bg-gradient-primary transition-all duration-1500 ease-out rounded-full"
              style={{ width: `${percentage()}%` }}
            />
          </div>
        </div>
      </Show>
    </div>
  );
};