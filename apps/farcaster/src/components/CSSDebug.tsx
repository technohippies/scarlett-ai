import { onMount } from 'solid-js';

export function CSSDebug() {
  onMount(() => {
    // Wait for DOM to update after song loads
    setTimeout(() => {
      console.log('=== CSS CLASS DEBUG (DELAYED) ===');
    
    // Find all elements with classes we expect
    const classesToCheck = [
      'bg-gradient-primary',
      'grid-cols-[1fr_1fr]',
      'bg-surface',
      'text-white',
      'shadow-lg',
      'bg-base',
      'w-px',
      'inline-flex',
      'rounded-md'
    ];
    
    classesToCheck.forEach(className => {
      const elements = document.querySelectorAll(`.${className.replace(/[\[\]]/g, '\\$&')}`);
      console.log(`Elements with class "${className}": ${elements.length}`);
      if (elements.length > 0) {
        const computed = getComputedStyle(elements[0]);
        if (className === 'bg-gradient-primary') {
          console.log(`  background-image: ${computed.backgroundImage}`);
        } else if (className === 'grid-cols-[1fr_1fr]') {
          console.log(`  display: ${computed.display}`);
          console.log(`  grid-template-columns: ${computed.gridTemplateColumns}`);
        } else if (className === 'bg-surface') {
          console.log(`  background-color: ${computed.backgroundColor}`);
        }
      }
    });
    
    // Check what CSS rules are actually loaded for these classes
    console.log('\n=== CSS RULES CHECK ===');
    const styleSheets = Array.from(document.styleSheets);
    styleSheets.forEach((sheet, sheetIndex) => {
      try {
        const rules = Array.from(sheet.cssRules || []);
        rules.forEach(rule => {
          if (rule instanceof CSSStyleRule) {
            if (rule.selectorText?.includes('bg-gradient-primary') ||
                rule.selectorText?.includes('grid-cols') ||
                rule.selectorText?.includes('bg-surface')) {
              console.log(`Sheet ${sheetIndex}: ${rule.selectorText} { ${rule.style.cssText} }`);
            }
          }
        });
      } catch (e) {
        // CORS or other access issues
      }
    });
    
    // Check the Tailwind/UI CSS specifically
    console.log('\n=== CHECKING IMPORTS ===');
    const links = document.querySelectorAll('link[rel="stylesheet"]');
    const styles = document.querySelectorAll('style');
    console.log(`Stylesheet links: ${links.length}`);
    console.log(`Style tags: ${styles.length}`);
    
    // Log the HTML of key elements
    console.log('\n=== ELEMENT HTML ===');
    const scorePanel = document.querySelector('.grid');
    if (scorePanel) {
      console.log('Score panel HTML:', scorePanel.outerHTML.substring(0, 200) + '...');
    }
    
    const startButton = document.querySelector('.bg-gradient-primary');
    if (startButton) {
      console.log('Start button HTML:', startButton.outerHTML.substring(0, 200) + '...');
    }
    }, 2000); // Wait 2 seconds for UI to load
  });
  
  return null;
}