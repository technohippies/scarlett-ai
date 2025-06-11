import { createSignal, createEffect, Show, onCleanup } from 'solid-js';
import type { Component } from 'solid-js';
import { cn } from '../../../utils/cn';
import styles from './FireEmojiAnimation.module.css';

export interface FireEmojiAnimationProps {
  score: number;
  lineIndex: number; // Use line index instead of trigger
  class?: string;
}

export const FireEmojiAnimation: Component<FireEmojiAnimationProps> = (props) => {
  const [showFire, setShowFire] = createSignal(false);
  const [fireX, setFireX] = createSignal(50);
  let lastLineIndex = -1;
  let hideTimer: number | undefined;
  
  createEffect(() => {
    // Check if we have a new line with high score
    if (props.lineIndex > lastLineIndex && props.score >= 80) {
      // Random X position between 20% and 80%
      setFireX(20 + Math.random() * 60);
      setShowFire(true);
      
      // Clear existing timer
      if (hideTimer) clearTimeout(hideTimer);
      
      // Hide after animation completes
      hideTimer = setTimeout(() => {
        setShowFire(false);
      }, 2000);
      
      lastLineIndex = props.lineIndex;
    }
  });
  
  onCleanup(() => {
    if (hideTimer) clearTimeout(hideTimer);
  });

  return (
    <Show when={showFire()}>
      <div class={cn(styles.fireContainer, props.class)}>
        <div
          class={styles.fireEmoji}
          style={{
            left: `${fireX()}%`,
            'font-size': '32px'
          }}
        >
          🔥
        </div>
      </div>
    </Show>
  );
};