import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { defineContentScript } from 'wxt/utils/define-content-script';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { render } from 'solid-js/web';
import { ContentApp } from '../src/apps/content/ContentApp';
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
        
        // Create wrapper with positioning
        const wrapper = document.createElement('div');
        wrapper.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          bottom: 20px;
          width: 400px;
          z-index: 99999;
          overflow: hidden;
          border-radius: 16px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
          display: flex;
          flex-direction: column;
        `;
        wrapper.className = 'karaoke-widget';
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