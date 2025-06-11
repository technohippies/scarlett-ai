import type { Component } from 'solid-js';

export interface MinimizedKaraokeProps {
  onClick: () => void;
}

export const MinimizedKaraoke: Component<MinimizedKaraokeProps> = (props) => {
  return (
    <button
      onClick={props.onClick}
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        width: '80px',
        height: '80px',
        'border-radius': '50%',
        background: 'linear-gradient(135deg, #FF006E 0%, #C13584 100%)',
        'box-shadow': '0 8px 32px rgba(0, 0, 0, 0.3)',
        display: 'flex',
        'align-items': 'center',
        'justify-content': 'center',
        overflow: 'hidden',
        cursor: 'pointer',
        'z-index': '99999',
        border: 'none',
        transition: 'transform 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
      }}
      aria-label="Open Karaoke"
    >
      {/* Place your 200x200 image here as: */}
      {/* <img src="/path/to/your/image.png" alt="Karaoke" style="width: 100%; height: 100%; object-fit: cover;" /> */}
      
      {/* For now, using a placeholder icon */}
      <span style={{ 'font-size': '36px' }}>🎤</span>
    </button>
  );
};