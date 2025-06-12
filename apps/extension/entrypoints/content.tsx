import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { defineContentScript } from 'wxt/utils/define-content-script';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { render } from 'solid-js/web';
import { ContentApp } from '../src/views/content/ContentApp';
import '../src/styles/extension.css';

export default defineContentScript({
  matches: ['*://soundcloud.com/*', '*://soundcloak.com/*', '*://sc.maid.zone/*', '*://*.maid.zone/*'],
  runAt: 'document_idle',
  cssInjectionMode: 'ui',

  async main(ctx: ContentScriptContext) {
    // Only run in top-level frame to avoid duplicate processing in iframes
    if (window.top !== window.self) {
      return;
    }

    // Create shadow DOM and mount karaoke widget
    const ui = await createShadowRootUi(ctx, {
      name: 'scarlett-karaoke-ui',
      position: 'overlay',
      anchor: 'body',
      onMount: async (container: HTMLElement) => {
        // Create wrapper div (ContentApp will handle positioning based on state)
        const wrapper = document.createElement('div');
        wrapper.className = 'karaoke-widget-container';
        container.appendChild(wrapper);

        // Render ContentApp component (which uses ExtensionKaraokeView)
        const dispose = render(() => <ContentApp />, wrapper);
        
        return dispose;
      },
      onRemove: (cleanup?: () => void) => {
        cleanup?.();
      },
    });

    // Mount the UI
    ui.mount();
  },
});