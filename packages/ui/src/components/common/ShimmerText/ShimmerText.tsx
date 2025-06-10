import { createEffect, createSignal } from 'solid-js';
import type { Component } from 'solid-js';
import { cn } from '../../../utils/cn';

export interface ShimmerTextProps {
  text: string;
  speed?: number; // ms per character (always character-based now)
  shimmer?: boolean;
  class?: string;
}

export const ShimmerText: Component<ShimmerTextProps> = (props) => {
  const [displayedText, setDisplayedText] = createSignal('');
  const [isStreaming, setIsStreaming] = createSignal(false);
  
  const speed = () => props.speed || 80; // Default human-readable pace
  const shimmer = () => props.shimmer !== false;
  
  // Stream text progressively
  createEffect(() => {
    if (!props.text) {
      setDisplayedText('');
      setIsStreaming(false);
      return;
    }
    
    // Reset if text changes completely
    if (!props.text.startsWith(displayedText())) {
      setDisplayedText('');
    }
    
    const currentLength = displayedText().length;
    if (currentLength >= props.text.length) {
      setIsStreaming(false);
      return;
    }
    
    setIsStreaming(true);
    
    const interval = setInterval(() => {
      const current = displayedText();
      
      if (current.length >= props.text.length) {
        setIsStreaming(false);
        clearInterval(interval);
        return;
      }
      
      // Always stream character by character for smooth effect
      setDisplayedText(props.text.slice(0, current.length + 1));
    }, speed());
    
    return () => clearInterval(interval);
  });
  
  return (
    <div class={cn('relative', props.class)}>
      {/* Invisible text to reserve space and prevent layout shifts */}
      <div class="invisible whitespace-pre-wrap" aria-hidden="true">
        {props.text}
      </div>
      
      {/* Visible streaming text positioned absolutely */}
      <div 
        class={cn(
          'absolute inset-0 whitespace-pre-wrap',
          shimmer() && isStreaming() && 'animate-shimmer-text'
        )}
      >
        {displayedText()}
      </div>
    </div>
  );
};