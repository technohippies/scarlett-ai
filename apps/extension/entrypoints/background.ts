export default defineBackground(() => {
  console.log('[Background] Scarlett extension background script started');

  // Handle extension installation
  chrome.runtime.onInstalled.addListener((details) => {
    console.log('[Background] Extension installed/updated:', details.reason);

    if (details.reason === 'install') {
      console.log('[Background] Extension installed for the first time');
    }
  });

  // Handle messages from content script or popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Background] Message received:', message);
    
    switch (message.type) {
      case 'START_KARAOKE':
        console.log('[Background] Starting karaoke session');
        break;
      default:
        console.log('[Background] Unknown message type:', message.type);
    }
  });
});

function defineBackground(fn: () => void) {
  fn();
}