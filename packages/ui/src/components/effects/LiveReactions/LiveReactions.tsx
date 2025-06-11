import { createSignal, createEffect, For, Show, onMount, onCleanup } from 'solid-js';
import type { Component } from 'solid-js';
import { cn } from '../../../utils/cn';
import styles from './LiveReactions.module.css';

interface Reaction {
  id: number;
  emoji: string;
  x: number;
  delay: number;
}

export interface LiveReactionsProps {
  score?: number;
  trigger?: boolean;
  class?: string;
}

export const LiveReactions: Component<LiveReactionsProps> = (props) => {
  const [reactions, setReactions] = createSignal<Reaction[]>([]);
  const [reactionId, setReactionId] = createSignal(0);
  let intervalCleanup: (() => void) | null = null;

  const emojis = ['❤️', '😍', '🎤', '🎵', '🎶', '💯', '⭐', '✨', '👏', '🙌'];
  const highScoreEmojis = ['🔥', '💯', '⭐', '✨', '🎯'];

  const addReaction = (emoji?: string) => {
    const selectedEmoji = emoji || emojis[Math.floor(Math.random() * emojis.length)];
    const newReaction: Reaction = {
      id: reactionId(),
      emoji: selectedEmoji,
      x: 10 + Math.random() * 80, // 10-90% of width
      delay: Math.random() * 0.3
    };

    setReactionId(prev => prev + 1);
    setReactions(prev => [...prev, newReaction]);

    // Remove after animation
    setTimeout(() => {
      setReactions(prev => prev.filter(r => r.id !== newReaction.id));
    }, 3000);
  };

  // Trigger reactions on high scores
  createEffect(() => {
    if (props.trigger && props.score && props.score >= 80) {
      // Add multiple reactions for high scores
      const reactionCount = props.score >= 95 ? 5 : props.score >= 90 ? 3 : 2;
      for (let i = 0; i < reactionCount; i++) {
        setTimeout(() => {
          const emoji = highScoreEmojis[Math.floor(Math.random() * highScoreEmojis.length)];
          addReaction(emoji);
        }, i * 200);
      }
    }
  });

  // Randomly add reactions
  const startRandomReactions = () => {
    const interval = setInterval(() => {
      if (Math.random() > 0.7) { // 30% chance every interval
        addReaction();
      }
    }, 2000);

    return () => clearInterval(interval);
  };

  onMount(() => {
    intervalCleanup = startRandomReactions();
  });

  onCleanup(() => {
    if (intervalCleanup) intervalCleanup();
  });

  return (
    <>
      <Show when={reactions().length > 0}>
        <div class={cn(styles.reactionsContainer, props.class)}>
          <For each={reactions()}>
            {(reaction) => (
              <div
                class={styles.reaction}
                style={{
                  left: `${reaction.x}%`,
                  'animation-delay': `${reaction.delay}s`
                }}
              >
                {reaction.emoji}
              </div>
            )}
          </For>
        </div>
      </Show>
    </>
  );
};