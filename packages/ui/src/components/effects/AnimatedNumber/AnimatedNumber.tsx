import { createSignal, createEffect, onCleanup } from 'solid-js';
import type { Component } from 'solid-js';

export interface AnimatedNumberProps {
  value: number;
  duration?: number;
  class?: string;
  format?: (value: number) => string;
}

export const AnimatedNumber: Component<AnimatedNumberProps> = (props) => {
  const [displayValue, setDisplayValue] = createSignal(0);
  const [prevValue, setPrevValue] = createSignal(0);
  
  createEffect(() => {
    const startValue = prevValue();
    const endValue = props.value;
    const duration = props.duration || 800;
    
    if (startValue === endValue) return;
    
    const startTime = Date.now();
    let animationFrame: number;
    
    const animate = () => {
      const now = Date.now();
      const progress = Math.min((now - startTime) / duration, 1);
      
      // Ease-out cubic function for smooth deceleration
      const easeOutCubic = 1 - Math.pow(1 - progress, 3);
      
      const currentValue = startValue + (endValue - startValue) * easeOutCubic;
      setDisplayValue(currentValue);
      
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        setDisplayValue(endValue);
        setPrevValue(endValue);
      }
    };
    
    animationFrame = requestAnimationFrame(animate);
    
    onCleanup(() => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    });
  });
  
  const formatValue = () => {
    const value = displayValue();
    if (props.format) {
      return props.format(value);
    }
    return Math.round(value).toString();
  };
  
  return (
    <span class={props.class}>
      {formatValue()}
    </span>
  );
};