import type { Meta, StoryObj } from '@storybook/html';
import { LyricDetailSlider, type LyricDetailSliderProps } from './LyricDetailSlider';
import { createSignal } from 'solid-js';
import { withI18n } from '../../../utils/i18n-story';
import { solidStory } from '../../../utils/storybook';

const meta: Meta<LyricDetailSliderProps> = {
  title: 'Karaoke/LyricDetailSlider',
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    isOpen: { control: 'boolean' },
    userLanguage: { control: 'text' },
    targetLanguage: { control: 'text' },
    isLoading: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<LyricDetailSliderProps>;

// Wrapper component to handle state
const LyricDetailSliderDemo = (props: LyricDetailSliderProps) => {
  const [isOpen, setIsOpen] = createSignal(props.isOpen ?? true);
  const [translatedText, setTranslatedText] = createSignal(props.lyric.translatedText);
  const [annotations, setAnnotations] = createSignal(props.lyric.annotations);
  const [isLoading, setIsLoading] = createSignal(false);
  
  // Simulate streaming translation
  const handleTranslate = async (targetLang: 'en' | 'es') => {
    console.log('Translating to:', targetLang);
    props.onTranslate?.(targetLang);
    
    setIsLoading(true);
    setTranslatedText(undefined);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Simulate streaming response
    const mockTranslation = targetLang === 'es' 
      ? "El tiempo de encender un fósforo"
      : "Time to strike a match";
    
    setTranslatedText(mockTranslation);
    setIsLoading(false);
  };
  
  // Simulate annotation loading
  const handleAnnotate = async () => {
    console.log('Getting annotations');
    props.onAnnotate?.();
    
    setIsLoading(true);
    setAnnotations(undefined);
    
    await new Promise(resolve => setTimeout(resolve, 800));
    
    setAnnotations([
      {
        word: "strike",
        meaning: "to hit forcefully; to light (a match) by rubbing",
        pronunciation: "straɪk"
      },
      {
        word: "match",
        meaning: "a small stick with a substance that burns when rubbed",
        pronunciation: "mætʃ"
      }
    ]);
    setIsLoading(false);
  };
  
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
      <LyricDetailSlider
        {...props}
        lyric={{
          ...props.lyric,
          translatedText: translatedText(),
          annotations: annotations()
        }}
        isOpen={isOpen()}
        isLoading={isLoading()}
        onClose={() => {
          setIsOpen(false);
          props.onClose?.();
        }}
        onTranslate={handleTranslate}
        onAnnotate={handleAnnotate}
      />
    </div>
  );
};

export const Default: Story = {
  render: (args, context) => withI18n(LyricDetailSliderDemo)(args, context),
  args: {
    isOpen: true,
    lyric: {
      text: "Time to strike a match"
    },
    songContext: {
      title: "TYRANT",
      artist: "Beyoncé",
      lineIndex: 1,
      totalLines: 70
    },
    userLanguage: 'en',
    onClose: () => console.log('Close'),
    onTranslate: (lang) => console.log('Translate to:', lang),
    onAnnotate: () => console.log('Annotate'),
  }
};

export const WithTranslation: Story = {
  render: (args, context) => withI18n(LyricDetailSliderDemo)(args, context),
  args: {
    ...Default.args,
    lyric: {
      text: "What doesn't kill you makes you stronger",
      translatedText: "Lo que no te mata te hace más fuerte"
    }
  }
};

export const WithAnnotations: Story = {
  render: (args, context) => withI18n(LyricDetailSliderDemo)(args, context),
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
  render: (args, context) => withI18n(LyricDetailSliderDemo)(args, context),
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
  render: (args, context) => withI18n(LyricDetailSliderDemo)(args, context),
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
  render: (args, context) => withI18n(LyricDetailSliderDemo)(args, context),
  args: {
    ...Default.args,
    onPractice: (text) => console.log('Practice:', text)
  }
};

export const Loading: Story = {
  render: (args, context) => withI18n(LyricDetailSliderDemo)(args, context),
  args: {
    ...Default.args,
    isLoading: true
  }
};

export const CompleteExample: Story = {
  render: (args, context) => withI18n(LyricDetailSliderDemo)(args, context),
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