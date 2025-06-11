import { createSignal, createEffect, For, Show } from 'solid-js';
import type { Component } from 'solid-js';
import { cn } from '../../../utils/cn';
import styles from './ScorePopup.module.css';

interface ScoreItem {
  id: number;
  score: number;
  x: number;
  y: number;
}

export interface ScorePopupProps {
  score: number | null;
  trigger?: boolean;
  class?: string;
}

export const ScorePopup: Component<ScorePopupProps> = (props) => {
  const [popups, setPopups] = createSignal<ScoreItem[]>([]);
  const [popupId, setPopupId] = createSignal(0);

  createEffect(() => {
    if (props.trigger && props.score !== null) {
      showScorePopup(props.score);
    }
  });

  const showScorePopup = (score: number) => {
    const newPopup: ScoreItem = {
      id: popupId(),
      score,
      x: 40 + Math.random() * 20, // 40-60% of width
      y: 30 + Math.random() * 20  // 30-50% of height
    };

    setPopupId(prev => prev + 1);
    setPopups(prev => [...prev, newPopup]);

    // Remove after animation
    setTimeout(() => {
      setPopups(prev => prev.filter(p => p.id !== newPopup.id));
    }, 2000);
  };

  const getScoreText = (score: number) => {
    if (score >= 95) return 'PERFECT!';
    if (score >= 90) return 'EXCELLENT!';
    if (score >= 80) return 'GREAT!';
    if (score >= 70) return 'GOOD!';
    if (score >= 60) return 'OK';
    return 'KEEP TRYING!';
  };

  const getScoreColor = (score: number) => {
    if (score >= 95) return '#ff3838';
    if (score >= 90) return '#ff6b6b';
    if (score >= 80) return '#ff8787';
    if (score >= 70) return '#ffa94d';
    if (score >= 60) return '#ffd43b';
    return '#adb5bd';
  };

  return (
    <Show when={popups().length > 0}>
      <div class={cn(styles.popupContainer, props.class)}>
        <For each={popups()}>
          {(popup) => (
            <div
              class={styles.scorePopup}
              style={{
                left: `${popup.x}%`,
                top: `${popup.y}%`,
                color: getScoreColor(popup.score),
                'text-shadow': `0 0 20px ${getScoreColor(popup.score)}40`
              }}
            >
              <div class={styles.scoreNumber}>{popup.score}%</div>
              <div class={styles.scoreText}>{getScoreText(popup.score)}</div>
            </div>
          )}
        </For>
      </div>
    </Show>
  );
};