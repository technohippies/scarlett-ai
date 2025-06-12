import { onMount } from 'solid-js';
import type { Component } from 'solid-js';

export const DebugStyles: Component = () => {
  onMount(() => {
    // Check computed styles of key elements
    setTimeout(() => {
      console.log('=== STYLE DEBUG ===');
      
      // Check if CSS variables are defined
      const root = document.documentElement;
      const computedStyle = getComputedStyle(root);
      console.log('CSS Variables:', {
        gradientPrimary: computedStyle.getPropertyValue('--gradient-primary'),
        colorBgBase: computedStyle.getPropertyValue('--color-bg-base'),
        colorBgSurface: computedStyle.getPropertyValue('--color-bg-surface'),
        colorAccentPrimary: computedStyle.getPropertyValue('--color-accent-primary'),
        colorAccentSecondary: computedStyle.getPropertyValue('--color-accent-secondary'),
      });
      
      // Check the actual computed gradient
      const gradientDiv = document.querySelector('.bg-gradient-primary');
      if (gradientDiv) {
        const gradientStyle = getComputedStyle(gradientDiv);
        console.log('Gradient element background:', gradientStyle.backgroundImage);
      }
      
      // Check Start button
      const startButton = document.querySelector('.bg-gradient-primary');
      if (startButton) {
        const btnStyle = getComputedStyle(startButton);
        console.log('Start button styles:', {
          backgroundImage: btnStyle.backgroundImage,
          backgroundColor: btnStyle.backgroundColor,
          color: btnStyle.color,
          classes: startButton.className,
        });
      }
      
      // Check grid
      const grid = document.querySelector('.grid');
      if (grid) {
        const gridStyle = getComputedStyle(grid);
        console.log('Grid styles:', {
          display: gridStyle.display,
          gridTemplateColumns: gridStyle.gridTemplateColumns,
          classes: grid.className,
        });
      }
      
      // Check all stylesheets
      console.log('Loaded stylesheets:');
      Array.from(document.styleSheets).forEach((sheet, i) => {
        try {
          console.log(`Sheet ${i}: ${sheet.href || 'inline'}`);
          if (!sheet.href || sheet.href.includes('localhost')) {
            console.log(`  Rules: ${sheet.cssRules.length}`);
          }
        } catch (e) {
          console.log(`  Sheet ${i}: Cannot access (CORS)`);
        }
      });
    }, 1000);
  });
  
  return null;
};