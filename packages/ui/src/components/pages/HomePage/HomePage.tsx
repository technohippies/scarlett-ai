import type { Component } from 'solid-js';
import { For } from 'solid-js';

export interface Song {
  id: string;
  trackId: string;
  title: string;
  artist: string;
}

export interface HomePageProps {
  songs: Song[];
  onSongSelect?: (song: Song) => void;
}

export const HomePage: Component<HomePageProps> = (props) => {
  const songItemStyle = {
    padding: '16px',
    'margin-bottom': '8px',
    'background-color': '#1a1a1a',
    'border-radius': '8px',
    cursor: 'pointer'
  };

  return (
    <div>
      <div style={{ padding: '16px', 'background-color': '#1a1a1a' }}>
        <h1 style={{ margin: '0 0 8px 0', 'font-size': '24px' }}>Popular Songs</h1>
        <p style={{ margin: '0', color: '#888' }}>Choose a song to start singing</p>
      </div>
      
      <div style={{ padding: '16px' }}>
        <For each={props.songs}>
          {(song, index) => (
            <div 
              style={songItemStyle}
              onClick={() => props.onSongSelect?.(song)}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2a2a2a'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
            >
              <div style={{ display: 'flex', gap: '16px' }}>
                <span style={{ color: '#666' }}>{index() + 1}</span>
                <div>
                  <div style={{ 'font-weight': 'bold' }}>{song.title}</div>
                  <div style={{ color: '#888' }}>{song.artist}</div>
                </div>
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  );
};