import { type Component, createMemo, For, onMount } from 'solid-js';
import { animate, stagger } from 'motion';
import { cn } from '../../../utils/cn';

export interface TextEffectProps {
  children: string;
  per?: 'word' | 'char';
  className?: string;
  delay?: number;
  preset?: 'fade' | 'slide' | 'blur' | 'scale';
}

export const TextEffect: Component<TextEffectProps> = (props) => {
  let containerRef: HTMLSpanElement | undefined;

  const segments = createMemo(() => {
    const text = props.children;
    if (props.per === 'char') {
      return text.split('').map((char, index) => ({ 
        content: char, 
        key: `char-${index}`,
        isSpace: char === ' '
      }));
    }
    // Default to word
    const words = text.split(' ');
    const result: Array<{ content: string; key: string; isSpace: boolean }> = [];
    words.forEach((word, index) => {
      result.push({ content: word, key: `word-${index}`, isSpace: false });
      if (index < words.length - 1) {
        result.push({ content: ' ', key: `space-${index}`, isSpace: true });
      }
    });
    return result;
  });

  onMount(() => {
    console.log('TextEffect onMount called');
    if (!containerRef) {
      console.log('No containerRef');
      return;
    }

    const items = containerRef.querySelectorAll('[data-text-item]');
    console.log('Found items:', items.length);
    if (items.length === 0) return;
    
    const preset = props.preset || 'fade';
    const initialDelay = props.delay || 0;

    // Set initial styles
    items.forEach((item, index) => {
      const element = item as HTMLElement;
      element.style.opacity = '0';
      console.log(`Set opacity=0 for item ${index}`);
      
      if (preset === 'slide') {
        element.style.transform = 'translateY(20px)';
      } else if (preset === 'blur') {
        element.style.filter = 'blur(4px)';
      } else if (preset === 'scale') {
        element.style.transform = 'scale(0.8)';
      }
    });

    // Try a simple CSS transition instead of Motion
    const startAnimation = () => {
      console.log('Starting animation');
      items.forEach((item, index) => {
        const element = item as HTMLElement;
        element.style.transition = 'all 0.4s ease-out';
        
        setTimeout(() => {
          console.log(`Animating item ${index}`);
          element.style.opacity = '1';
          
          if (preset === 'slide') {
            element.style.transform = 'translateY(0)';
          } else if (preset === 'blur') {
            element.style.filter = 'blur(0px)';
          } else if (preset === 'scale') {
            element.style.transform = 'scale(1)';
          }
        }, index * 50);
      });
    };

    if (initialDelay > 0) {
      setTimeout(startAnimation, initialDelay * 1000);
    } else {
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(startAnimation);
    }
  });

  return (
    <span
      ref={(el) => containerRef = el}
      class={cn('inline-block', props.className)}
    >
      <For each={segments()}>
        {(segment) => (
          <span
            data-text-item
            class={cn(
              'inline-block',
              segment.isSpace && 'w-[0.25em]'
            )}
            style={{
              'white-space': segment.isSpace ? 'pre' : 'normal'
            }}
          >
            {segment.content}
          </span>
        )}
      </For>
    </span>
  );
};