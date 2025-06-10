import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { defineContentScript } from 'wxt/utils/define-content-script';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { render } from 'solid-js/web';
import { ExtensionKaraokeView } from '@scarlett/ui';
import '@scarlett/ui/styles/globals.css';

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

    // Create shadow DOM and mount karaoke widget
    const ui = await createShadowRootUi(ctx, {
      name: 'scarlett-karaoke-ui',
      position: 'overlay',
      anchor: 'body',
      onMount: async (container: HTMLElement) => {
        // Inject basic styles that work without Tailwind v4 runtime
        const style = document.createElement('style');
        style.textContent = `
          /* Core theme variables */
          :root {
            --color-bg-base: #0a0a0a;
            --color-bg-surface: #161616;
            --color-bg-elevated: #1f1f1f;
            --color-text-primary: #fafafa;
            --color-text-secondary: #a8a8a8;
            --color-text-muted: #737373;
            --color-accent-primary: #8b5cf6;
            --color-border-default: #404040;
          }
          
          /* Reset */
          * { box-sizing: border-box; margin: 0; padding: 0; }
          
          /* Utility classes the component actually uses */
          .flex { display: flex; }
          .flex-col { flex-direction: column; }
          .h-full { height: 100%; }
          .bg-base { background-color: var(--color-bg-base); }
          .bg-surface { background-color: var(--color-bg-surface); }
          .bg-elevated { background-color: var(--color-bg-elevated); }
          .text-primary { color: var(--color-text-primary); }
          .text-secondary { color: var(--color-text-secondary); }
          .text-muted { color: var(--color-text-muted); }
          .grid { display: grid; }
          .grid-cols-\\[1fr_1fr\\] { grid-template-columns: 1fr 1fr; }
          .gap-2 { gap: 0.5rem; }
          .p-4 { padding: 1rem; }
          .rounded-lg { border-radius: 0.5rem; }
          .items-center { align-items: center; }
          .justify-center { justify-content: center; }
          .min-h-\\[80px\\] { min-height: 80px; }
          .text-lg { font-size: 1.125rem; line-height: 1.75rem; }
          .font-bold { font-weight: 700; }
          .text-sm { font-size: 0.875rem; line-height: 1.25rem; }
          .border-b { border-bottom-width: 1px; }
          .border-default { border-color: var(--color-border-default); }
          .px-4 { padding-left: 1rem; padding-right: 1rem; }
          .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
          .cursor-pointer { cursor: pointer; }
          .bg-accent { background-color: var(--color-accent-primary); }
          .overflow-y-auto { overflow-y: auto; }
          .space-y-8 > * + * { margin-top: 2rem; }
          .text-center { text-align: center; }
          .text-2xl { font-size: 1.5rem; line-height: 2rem; }
          .leading-relaxed { line-height: 1.625; }
          .font-semibold { font-weight: 600; }
          .scale-110 { transform: scale(1.1); }
          .opacity-60 { opacity: 0.6; }
          .transition-all { transition-property: all; }
          .duration-300 { transition-duration: 300ms; }
          
          /* Component specific styles */
          .karaoke-widget {
            font-family: system-ui, -apple-system, sans-serif;
            color: var(--color-text-primary);
          }
          
          button {
            border: none;
            background: none;
            font: inherit;
            color: inherit;
            cursor: pointer;
          }
        `;
        container.appendChild(style);

        // Mock data matching the story exactly
        const mockData = {
          score: 8750,
          rank: 4,
          lyrics: [
            { id: '1', text: "Is this the real life?", startTime: 0, duration: 3 },
            { id: '2', text: "Is this just fantasy?", startTime: 3, duration: 3 },
            { id: '3', text: "Caught in a landslide", startTime: 6, duration: 3 },
            { id: '4', text: "No escape from reality", startTime: 9, duration: 4 },
            { id: '5', text: "Open your eyes", startTime: 13, duration: 3 },
            { id: '6', text: "Look up to the skies and see", startTime: 16, duration: 5 },
            { id: '7', text: "I'm just a poor boy", startTime: 21, duration: 3 },
            { id: '8', text: "I need no sympathy", startTime: 24, duration: 3 },
          ],
          leaderboard: [
            { rank: 1, username: 'KaraokeKing', score: 12500 },
            { rank: 2, username: 'SongBird92', score: 11200 },
            { rank: 3, username: 'MelodyMaster', score: 10800 },
            { rank: 4, username: 'CurrentUser', score: 8750, isCurrentUser: true },
            { rank: 5, username: 'VocalVirtuoso', score: 8200 },
          ],
          currentTime: 12,
          isPlaying: true,
          onStart: () => console.log('Start karaoke!'),
          onSpeedChange: (speed) => console.log('Speed changed to:', speed),
        };

        // Create wrapper with positioning
        const wrapper = document.createElement('div');
        wrapper.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          width: 400px;
          height: 500px;
          z-index: 99999;
        `;
        container.appendChild(wrapper);

        // Render ExtensionKaraokeView component
        const dispose = render(() => <ExtensionKaraokeView {...mockData} />, wrapper);
        
        return dispose;
      },
      onRemove: (cleanup?: () => void) => {
        cleanup?.();
      },
    });

    // Mount the UI
    ui.mount();
    console.log('[Scarlett CS] Karaoke overlay mounted');
  },
});