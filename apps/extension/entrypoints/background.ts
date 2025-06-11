import { defineBackground } from '#imports';
import { browser } from 'wxt/browser';

export default defineBackground(() => {
  console.log('[Background] Script started');

  // Handle extension installation
  browser.runtime.onInstalled.addListener((details) => {
    console.log('[Background] Extension installed/updated:', details.reason);

    if (details.reason === 'install') {
      // Open the oninstall page when the extension is first installed
      browser.tabs.create({
        url: browser.runtime.getURL('/oninstall.html'),
        active: true,
      });
    }
  });
});