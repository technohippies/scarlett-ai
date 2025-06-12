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
        console.log('[Content Script] onMount called, container:', container);
        console.log('[Content Script] Shadow root:', container.getRootNode());
        
        // Log what stylesheets are available
        const shadowRoot = container.getRootNode() as ShadowRoot;
        console.log('[Content Script] Shadow root stylesheets:', shadowRoot.styleSheets?.length);
        
        // Create wrapper div (ContentApp will handle positioning based on state)
        const wrapper = document.createElement('div');
        wrapper.className = 'karaoke-widget-container';
        container.appendChild(wrapper);

        console.log('[Content Script] Wrapper created and appended:', wrapper);
        console.log('[Content Script] Wrapper computed styles:', window.getComputedStyle(wrapper));

        // Render ContentApp component (which uses ExtensionKaraokeView)
        console.log('[Content Script] About to render ContentApp');
        const dispose = render(() => <ContentApp />, wrapper);
        
        console.log('[Content Script] ContentApp rendered, dispose function:', dispose);
        
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