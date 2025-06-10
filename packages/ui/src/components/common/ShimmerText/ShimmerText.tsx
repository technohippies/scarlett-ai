import { createEffect, createSignal } from 'solid-js';
import type { Component } from 'solid-js';
import { cn } from '../../../utils/cn';

export interface ShimmerTextProps {
  text: string;
  speed?: number; // ms per character
  shimmer?: boolean;
  class?: string;
}

export const ShimmerText: Component<ShimmerTextProps> = (props) => {
  const [displayedText, setDisplayedText] = createSignal('');
  const [isComplete, setIsComplete] = createSignal(false);
  
  const speed = () => props.speed || 80; // Default human-readable pace
  const shimmer = () => props.shimmer !== false;
  
  // Stream text progressively
  createEffect(() => {
    if (!props.text) {
      setDisplayedText('');
      setIsComplete(false);
      return;
    }
    
    // Reset if text changes completely
    if (!props.text.startsWith(displayedText())) {
      setDisplayedText('');
      setIsComplete(false);
    }
    
    const currentLength = displayedText().length;
    if (currentLength >= props.text.length) {
      setIsComplete(true);
      return;
    }
    
    setIsComplete(false);
    
    const interval = setInterval(() => {
      const current = displayedText();
      
      if (current.length >= props.text.length) {
        setIsComplete(true);
        clearInterval(interval);
        return;
      }
      
      // Stream character by character
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
      
      {/* Visible streaming text */}
      <div 
        class={cn(
          'absolute inset-0 whitespace-pre-wrap',
          shimmer() && !isComplete() && 'animate-shimmer-text'
        )}
      >
        {displayedText()}
      </div>
    </div>
  );
};