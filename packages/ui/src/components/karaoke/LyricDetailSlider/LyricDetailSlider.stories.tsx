import type { Meta, StoryObj } from 'storybook-solidjs';
import { LyricDetailSlider } from './LyricDetailSlider';
import { createSignal } from 'solid-js';

const meta = {
  title: 'Karaoke/LyricDetailSlider',
  component: LyricDetailSlider,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => {
      const [isOpen, setIsOpen] = createSignal(true);
      
      return (
        <div style={{ 'min-height': '100vh', background: '#0a0a0a', padding: '20px' }}>
          <button
            onClick={() => setIsOpen(true)}
            style={{
              padding: '10px 20px',
              background: '#ff3838',
              color: 'white',
              border: 'none',
              'border-radius': '8px',
              cursor: 'pointer'
            }}
          >
            Open Lyric Detail
          </button>
          <Story isOpen={isOpen()} onClose={() => setIsOpen(false)} />
        </div>
      );
    }
  ],
} satisfies Meta<typeof LyricDetailSlider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    isOpen: true,
    lyric: {
      text: "What doesn't kill you makes you stronger"
    },
    songContext: {
      title: "Stronger",
      artist: "Kelly Clarkson",
      lineIndex: 5,
      totalLines: 42
    },
    userLanguage: 'en',
    onClose: () => console.log('Close'),
    onTranslate: (lang) => console.log('Translate to:', lang),
    onAnnotate: () => console.log('Annotate'),
  }
};

export const WithTranslation: Story = {
  args: {
    ...Default.args,
    lyric: {
      text: "What doesn't kill you makes you stronger",
      translatedText: "Lo que no te mata te hace más fuerte"
    }
  }
};

export const WithAnnotations: Story = {
  args: {
    ...Default.args,
    lyric: {
      text: "What doesn't kill you makes you stronger",
      annotations: [
        {
          word: "doesn't",
          meaning: "contraction of 'does not'",
          pronunciation: "ˈdʌzənt"
        },
        {
          word: "stronger",
          meaning: "having greater strength or power",
          pronunciation: "ˈstrɔːŋɡər"
        }
      ]
    }
  }
};

export const ChineseWithRomanization: Story = {
  args: {
    isOpen: true,
    lyric: {
      text: "月亮代表我的心",
      romanization: "yuè liàng dài biǎo wǒ de xīn",
      translatedText: "The moon represents my heart"
    },
    songContext: {
      title: "月亮代表我的心",
      artist: "Teresa Teng",
      lineIndex: 0,
      totalLines: 30
    },
    userLanguage: 'zh-CN',
    onClose: () => console.log('Close'),
    onTranslate: (lang) => console.log('Translate to:', lang),
    onAnnotate: () => console.log('Annotate'),
  }
};

export const SpanishSpeaker: Story = {
  args: {
    isOpen: true,
    lyric: {
      text: "Yesterday, all my troubles seemed so far away"
    },
    songContext: {
      title: "Yesterday",
      artist: "The Beatles",
      lineIndex: 0,
      totalLines: 20
    },
    userLanguage: 'es-MX',
    targetLanguage: 'en',
    onClose: () => console.log('Close'),
    onTranslate: (lang) => console.log('Translate to:', lang),
    onAnnotate: () => console.log('Annotate'),
  }
};

export const WithPracticeButton: Story = {
  args: {
    ...Default.args,
    onPractice: (text) => console.log('Practice:', text)
  }
};

export const Loading: Story = {
  args: {
    ...Default.args,
    isLoading: true
  }
};

export const CompleteExample: Story = {
  args: {
    isOpen: true,
    lyric: {
      text: "I've got the eye of the tiger",
      translatedText: "Tengo el ojo del tigre",
      annotations: [
        {
          word: "I've",
          meaning: "contraction of 'I have'",
          pronunciation: "aɪv"
        },
        {
          word: "eye of the tiger",
          meaning: "idiom meaning fierce determination and focus",
          pronunciation: "aɪ əv ðə ˈtaɪɡər"
        }
      ]
    },
    songContext: {
      title: "Eye of the Tiger",
      artist: "Survivor",
      lineIndex: 10,
      totalLines: 35
    },
    userLanguage: 'en',
    onClose: () => console.log('Close'),
    onTranslate: (lang) => console.log('Translate to:', lang),
    onAnnotate: () => console.log('Annotate'),
    onPractice: (text) => console.log('Practice:', text)
  }
};