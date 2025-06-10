import { onMount } from 'solid-js';
import type { Component } from 'solid-js';
import { animate } from 'motion';

export const SimpleTest: Component = () => {
  let boxRef: HTMLDivElement | undefined;

  onMount(() => {
    if (boxRef) {
      // Simple test animation
      animate(
        boxRef,
        { opacity: [0, 1], scale: [0.5, 1] },
        { duration: 1, easing: 'ease-out' }
      );
    }
  });

  return (
    <div 
      ref={boxRef}
      style={{ 
        width: '100px', 
        height: '100px', 
        background: 'purple',
        opacity: 0
      }}
    >
      Test Box
    </div>
  );
};