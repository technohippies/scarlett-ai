import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { defineContentScript } from 'wxt/utils/define-content-script';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { render } from 'solid-js/web';

export default defineContentScript({
  matches: ['*://soundcloud.com/*', '*://soundcloak.com/*', '*://sc.maid.zone/*', '*://*.maid.zone/*'],
  runAt: 'document_idle',
  cssInjectionMode: 'ui',

  async main(ctx: ContentScriptContext) {
    // Only run in top-level frame to avoid duplicate processing in iframes
    if (window.top !== window.self) {
      console.log('[Scarlett CS] Not top-level frame, skipping content script.');
      return;
    }

    console.log('[Scarlett CS] Scarlett Karaoke content script loaded');
    
    // Add a simple test element first to verify injection works
    const testDiv = document.createElement('div');
    testDiv.style.cssText = `
      position: fixed;
      top: 10px;
      left: 10px;
      background: red;
      color: white;
      padding: 10px;
      z-index: 99999;
      border-radius: 4px;
    `;
    testDiv.textContent = 'Scarlett Extension Loaded!';
    document.body.appendChild(testDiv);
    
    // Remove test div after 3 seconds
    setTimeout(() => testDiv.remove(), 3000);

    // Mock data for testing
    const mockData = {
      score: 85,
      rank: 3,
      lyrics: [
        { id: '1', text: 'Hello world', startTime: 0, endTime: 2 },
        { id: '2', text: 'This is a test', startTime: 2, endTime: 4 },
        { id: '3', text: 'Karaoke extension', startTime: 4, endTime: 6 },
      ],
      leaderboard: [
        { id: '1', name: 'Player 1', score: 95, rank: 1 },
        { id: '2', name: 'Player 2', score: 90, rank: 2 },
        { id: '3', name: 'You', score: 85, rank: 3 },
      ],
      currentTime: 1,
      isPlaying: false,
    };

    // Create shadow DOM and mount SolidJS component
    const ui = await createShadowRootUi(ctx, {
      name: 'scarlett-karaoke-ui',
      position: 'overlay',
      anchor: 'body',
      onMount: (container: HTMLElement) => {
        // Create a wrapper div with proper styling
        const wrapper = document.createElement('div');
        wrapper.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          width: 400px;
          height: 500px;
          z-index: 10000;
          background: white;
          border: 2px solid #333;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          font-family: system-ui, -apple-system, sans-serif;
          color: #333;
          overflow: hidden;
        `;
        
        // Add CSS for Tailwind classes
        const style = document.createElement('style');
        style.textContent = `
          * { box-sizing: border-box; }
          .bg-base { background-color: #ffffff; }
          .bg-surface { background-color: #f8f9fa; }
          .border-subtle { border-color: #e5e7eb; }
          .text-lg { font-size: 1.125rem; line-height: 1.75rem; }
          .text-sm { font-size: 0.875rem; line-height: 1.25rem; }
          .font-bold { font-weight: 700; }
          .font-medium { font-weight: 500; }
          .p-4 { padding: 1rem; }
          .px-4 { padding-left: 1rem; padding-right: 1rem; }
          .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
          .mb-2 { margin-bottom: 0.5rem; }
          .mb-4 { margin-bottom: 1rem; }
          .flex { display: flex; }
          .flex-col { flex-direction: column; }
          .flex-1 { flex: 1 1 0%; }
          .h-full { height: 100%; }
          .w-full { width: 100%; }
          .overflow-hidden { overflow: hidden; }
          .overflow-y-auto { overflow-y: auto; }
          .border { border-width: 1px; }
          .border-t { border-top-width: 1px; }
          .rounded-lg { border-radius: 0.5rem; }
          .rounded { border-radius: 0.25rem; }
          .shadow-sm { box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); }
          .text-center { text-align: center; }
          .cursor-pointer { cursor: pointer; }
          .hover\\:bg-gray-100:hover { background-color: #f3f4f6; }
          .bg-blue-500 { background-color: #3b82f6; }
          .text-white { color: #ffffff; }
          .text-gray-600 { color: #4b5563; }
          .text-gray-900 { color: #111827; }
          button { border: none; background: none; font: inherit; cursor: pointer; }
        `;
        
        container.appendChild(style);
        container.appendChild(wrapper);
        
        // Test with a simple SolidJS component first
        const dispose = render(() => (
          <div class="p-4">
            <h2 class="text-lg font-bold mb-4">Scarlett Karaoke</h2>
            <div class="mb-2">Score: {mockData.score}</div>
            <div class="mb-4">Rank: #{mockData.rank}</div>
            <div class="mb-4">
              <h3 class="font-medium mb-2">Lyrics:</h3>
              {mockData.lyrics.map(lyric => (
                <div class="text-sm py-1">{lyric.text}</div>
              ))}
            </div>
            <button class="bg-blue-500 text-white px-4 py-2 rounded">
              Start Karaoke
            </button>
          </div>
        ), wrapper);
        return dispose; // Return cleanup function
      },
      onRemove: (cleanup?: () => void) => {
        cleanup?.(); // Clean up SolidJS component
      },
    });

    // Mount the UI
    ui.mount();
    console.log('[Scarlett CS] Karaoke overlay mounted');
  },
});