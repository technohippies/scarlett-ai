import { createSignal, createEffect, Show } from 'solid-js';
import type { Component } from 'solid-js';
import { cn } from '../../../utils/cn';
import styles from './ComboDisplay.module.css';

export interface ComboDisplayProps {
  combo: number;
  class?: string;
}

export const ComboDisplay: Component<ComboDisplayProps> = (props) => {
  const [showAnimation, setShowAnimation] = createSignal(false);
  const [previousCombo, setPreviousCombo] = createSignal(0);

  createEffect(() => {
    if (props.combo > previousCombo() && props.combo > 1) {
      setShowAnimation(true);
      setTimeout(() => setShowAnimation(false), 600);
    }
    setPreviousCombo(props.combo);
  });

  const getComboText = () => {
    const combo = props.combo;
    if (combo >= 10) return 'ON FIRE!';
    if (combo >= 7) return 'AMAZING!';
    if (combo >= 5) return 'GREAT!';
    if (combo >= 3) return 'NICE!';
    return '';
  };

  const getComboColor = () => {
    const combo = props.combo;
    if (combo >= 10) return '#ff3838'; // Bright red
    if (combo >= 7) return '#ff6b6b'; // Orange-red
    if (combo >= 5) return '#ffa94d'; // Orange
    if (combo >= 3) return '#ffd43b'; // Yellow
    return '#74c0fc'; // Blue
  };

  return (
    <Show when={props.combo >= 2}>
      <div class={cn(styles.comboContainer, props.class)}>
        <div 
          class={cn(
            styles.comboNumber,
            showAnimation() && styles.comboBounce
          )}
          style={{
            color: getComboColor(),
            'text-shadow': `0 0 20px ${getComboColor()}40`
          }}
        >
          {props.combo}x
        </div>
        <Show when={props.combo >= 3}>
          <div 
            class={styles.comboText}
            style={{ color: getComboColor() }}
          >
            {getComboText()}
          </div>
        </Show>
      </div>
    </Show>
  );
};