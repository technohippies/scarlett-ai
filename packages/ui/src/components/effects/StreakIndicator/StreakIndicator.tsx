import { createSignal, createEffect, Show } from 'solid-js';
import type { Component } from 'solid-js';
import { cn } from '../../../utils/cn';
import { useI18n } from '../../../i18n';
import styles from './StreakIndicator.module.css';

export interface StreakIndicatorProps {
  combo: number;
  class?: string;
}

export const StreakIndicator: Component<StreakIndicatorProps> = (props) => {
  const { t } = useI18n();
  const [showFlame, setShowFlame] = createSignal(false);
  
  createEffect(() => {
    setShowFlame(props.combo >= 5);
  });

  const getFlameIntensity = () => {
    if (props.combo >= 15) return 'intense';
    if (props.combo >= 10) return 'strong';
    if (props.combo >= 5) return 'normal';
    return '';
  };

  return (
    <Show when={showFlame()}>
      <div class={cn(styles.streakContainer, props.class)}>
        <div 
          class={cn(
            styles.streakFlame,
            styles[getFlameIntensity()]
          )}
        >
          <div class={styles.flameEmoji}>🔥</div>
          <div class={styles.streakText}>
            {props.combo >= 15 ? t('karaoke.streak.unstoppable') : 
             props.combo >= 10 ? t('karaoke.streak.legendary') : 
             t('karaoke.streak.onFire')}
          </div>
        </div>
      </div>
    </Show>
  );
};