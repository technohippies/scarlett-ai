function Popup() {
  const handleStartKaraoke = () => {
    // Send message to background script or content script
    chrome.runtime.sendMessage({ type: 'START_KARAOKE' });
  };

  return (
    <div style="width: 384px; background: white; padding: 16px; font-family: system-ui;">
      <h1 style="font-size: 18px; font-weight: bold; margin-bottom: 16px;">
        Scarlett Karaoke
      </h1>
      <p style="margin-bottom: 16px; color: #666;">
        AI-powered karaoke learning extension
      </p>
      <button 
        style="
          width: 100%; 
          background: #3b82f6; 
          color: white; 
          padding: 8px 16px; 
          border: none; 
          border-radius: 4px; 
          cursor: pointer;
          font-size: 14px;
        "
        onClick={handleStartKaraoke}
      >
        Start Karaoke Session
      </button>
    </div>
  );
}

export default Popup;