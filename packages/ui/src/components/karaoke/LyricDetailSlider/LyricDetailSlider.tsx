import type { Component } from 'solid-js';
import { Show, createEffect, onCleanup, createSignal, For } from 'solid-js';
import { Portal } from 'solid-js/web';
import { Transition } from 'solid-transition-group';
import { Button } from '../../common/Button';
import { TextEffect } from '../../common/TextEffect';
import { MarkdownRenderer } from '../../common/MarkdownRenderer';
import { cn } from '../../../utils/cn';
import { useI18n } from '../../../i18n';
// Icon components
const TranslateIcon = () => (
  <svg viewBox="0 0 256 256" fill="currentColor" class="w-full h-full">
    <path d="M160,129.89l0,0s0-.07,0,0Zm64-49.89v88a16,16,0,0,1-16,16H48a16,16,0,0,1-16-16V80A16,16,0,0,1,48,64H208A16,16,0,0,1,224,80ZM200.3,144h-30a8,8,0,0,0,0,16h30a8,8,0,0,0,0-16Zm-66.34,0H87.05A65.46,65.46,0,0,0,83.8,128H112a8,8,0,0,0,0-16H81.91a64.36,64.36,0,0,0-12.17-24H152V88h16V80a8,8,0,0,0-16,0v8H136V80a8,8,0,0,0-16,0v8H108a8,8,0,0,0,0,16h1.74A80.32,80.32,0,0,1,114.25,112H72a8,8,0,0,0,0,16h39.94C108.25,139.69,99.35,144,87.05,144c-17.76,0-28-20.18-28.06-20.3a8,8,0,0,0-13.85,8c.06.1,1.65,2.67,4.56,6.3H48a16,16,0,0,0,16,16h85.42c2.71,3.23,7.66,8,16,8,6.86,0,13-5.42,17.59-14.34L203.88,102A8,8,0,0,0,189.66,96.7L169.8,141.76C166.84,143.75,163.77,144,161.33,144Z"/>
  </svg>
);

const QuestionIcon = () => (
  <svg viewBox="0 0 256 256" fill="currentColor" class="w-full h-full">
    <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,168a12,12,0,1,1,12-12A12,12,0,0,1,128,192Zm8-48.72V144a8,8,0,0,1-16,0v-8a8,8,0,0,1,8-8c13.23,0,24-9,24-20s-10.77-20-24-20-24,9-24,20v4a8,8,0,0,1-16,0v-4c0-19.85,17.94-36,40-36s40,16.15,40,36C168,127.23,154.24,141.93,136,143.28Z"/>
  </svg>
);

const BookIcon = () => (
  <svg viewBox="0 0 256 256" fill="currentColor" class="w-full h-full">
    <path d="M240,56V200a8,8,0,0,1-8,8H160a24,24,0,0,0-24,24,8,8,0,0,1-16,0,24,24,0,0,0-24-24H24a8,8,0,0,1-8-8V56a8,8,0,0,1,8-8H88a32,32,0,0,1,32,32v87.73c0,.15,0,.29,0,.43s0,.29,0,.43V80a32,32,0,0,1,32-32h64A8,8,0,0,1,240,56Z"/>
  </svg>
);
import { Spinner } from '../../common/Spinner';

export interface LyricDetailSliderProps {
  isOpen: boolean;
  lyric: {
    text: string;
    translatedText?: string;
    romanization?: string;
    annotations?: Array<{
      word: string;
      meaning: string;
      pronunciation?: string;
    }>;
  };
  songContext: {
    title: string;
    artist: string;
    lineIndex: number;
    totalLines: number;
  };
  userLanguage?: string;
  targetLanguage?: 'en' | 'es' | 'zh' | 'zh-CN' | 'zh-TW';
  isLoading?: boolean;
  onClose: () => void;
  onTranslate: (targetLang: 'en' | 'es' | 'zh' | 'zh-CN' | 'zh-TW' | null) => void;
  onExplainMeaning: () => void;
  onExplainGrammar: () => void;
  onPractice?: (text: string) => void;
}

export const LyricDetailSlider: Component<LyricDetailSliderProps> = (props) => {
  const { t } = useI18n();
  const [showTranslation, setShowTranslation] = createSignal(true); // Always show translation area to maintain layout
  const [showAnnotations, setShowAnnotations] = createSignal(false);
  const [selectedTargetLang, setSelectedTargetLang] = createSignal<'en' | 'es' | 'zh' | 'zh-CN' | 'zh-TW' | null>(null);
  const [isStreaming, setIsStreaming] = createSignal(false);
  const [isUnsupportedLanguage, setIsUnsupportedLanguage] = createSignal(false);
  
  // Auto-detect if we should translate to English or Spanish
  createEffect(() => {
    const userLang = props.userLanguage || '';
    console.log('[LyricDetailSlider] Language detection - userLang:', userLang);
    
    if (userLang.startsWith('es')) {
      // Spanish speakers -> translate to Spanish (their native language)
      console.log('[LyricDetailSlider] Detected Spanish, setting target to Spanish');
      setSelectedTargetLang('es');
    } else if (userLang.startsWith('en')) {
      // English speakers -> translate to English (their native language)
      console.log('[LyricDetailSlider] Detected English, setting target to English');
      setSelectedTargetLang('en');
    } else if (userLang.startsWith('zh')) {
      // Chinese speakers -> translate to Chinese
      if (userLang === 'zh-tw' || userLang === 'zh-hk') {
        console.log('[LyricDetailSlider] Detected Traditional Chinese, setting target to zh-TW');
        setSelectedTargetLang('zh-TW');
      } else {
        console.log('[LyricDetailSlider] Detected Simplified Chinese, setting target to zh-CN');
        setSelectedTargetLang('zh-CN');
      }
      setIsUnsupportedLanguage(false);
    } else {
      // For other unsupported languages
      console.log('[LyricDetailSlider] Detected unsupported language:', userLang);
      setSelectedTargetLang(null);
      setIsUnsupportedLanguage(true);
    }
  });
  
  // Reset states when slider opens/closes
  createEffect(() => {
    if (!props.isOpen) {
      // Don't reset showTranslation to maintain layout
      setShowAnnotations(false);
    }
  });
  
  // Show translation when available
  createEffect(() => {
    if (props.lyric.translatedText) {
      setShowTranslation(true);
    }
  });
  
  // Lock body scroll when slider is open
  createEffect(() => {
    if (props.isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      onCleanup(() => {
        document.body.style.overflow = originalOverflow;
      });
    }
  });

  // Handle escape key
  createEffect(() => {
    if (props.isOpen) {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          props.onClose();
        }
      };
      document.addEventListener('keydown', handleEscape);
      onCleanup(() => document.removeEventListener('keydown', handleEscape));
    }
  });

  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      props.onClose();
    }
  };
  
  // Auto-translate on open
  createEffect(() => {
    if (props.isOpen && !props.lyric.translatedText && !props.isLoading && selectedTargetLang() !== null) {
      console.log('[LyricDetailSlider] Auto-translate triggered');
      console.log('[LyricDetailSlider] User language:', props.userLanguage);
      console.log('[LyricDetailSlider] Selected target lang:', selectedTargetLang());
      setShowTranslation(true);
      props.onTranslate(selectedTargetLang()!);
    }
  });
  
  const handleExplainMeaning = (e: MouseEvent) => {
    e.stopPropagation();
    setShowAnnotations(true);
    props.onExplainMeaning();
  };
  
  const handleExplainGrammar = (e: MouseEvent) => {
    e.stopPropagation();
    setShowAnnotations(true);
    props.onExplainGrammar();
  };
  
  const getLanguageName = (code: string) => {
    const languages: Record<string, string> = {
      'en': 'English',
      'es': 'Spanish',
      'zh': 'Chinese',
      'ja': 'Japanese',
      'ko': 'Korean',
      'fr': 'French',
      'de': 'German',
      'pt': 'Portuguese'
    };
    return languages[code.split('-')[0]] || code;
  };

  return (
    <Portal>
      <Transition
        enterActiveClass="transition-opacity duration-300"
        enterClass="opacity-0"
        enterToClass="opacity-100"
        exitActiveClass="transition-opacity duration-300"
        exitClass="opacity-100"
        exitToClass="opacity-0"
      >
        <Show when={props.isOpen}>
          <div
            class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={handleBackdropClick}
          />
        </Show>
      </Transition>

      <Transition
        enterActiveClass="transition-transform duration-300 ease-out"
        enterClass="translate-y-full"
        enterToClass="translate-y-0"
        exitActiveClass="transition-transform duration-300 ease-in"
        exitClass="translate-y-0"
        exitToClass="translate-y-full"
      >
        <Show when={props.isOpen}>
          <div class="fixed inset-x-0 bottom-0 z-50 overflow-hidden">
            <div class="bg-elevated rounded-t-3xl shadow-2xl h-[70vh] overflow-hidden flex flex-col relative">
              {/* Close button */}
              <div class="absolute top-4 right-4 z-10">
                <button
                  onClick={props.onClose}
                  class="p-2 rounded-lg bg-surface/50 hover:bg-surface transition-all hover:scale-110"
                  aria-label={t('karaoke.lyricDetail.close')}
                >
                  <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div class="flex flex-col flex-1 overflow-hidden">
                <div class="px-6 pt-6 pb-4 overflow-y-auto flex-1">
                  <div class="space-y-4">
                    {/* Original lyric */}
                    <div class="text-xl leading-relaxed text-primary break-words">
                      {props.lyric.text}
                    </div>
                    
                    {/* Romanization */}
                    <Show when={props.lyric.romanization}>
                      <div class="text-base text-secondary italic break-words">
                        {props.lyric.romanization}
                      </div>
                    </Show>
                    
                    {/* Sections container with consistent spacing */}
                    <div class="space-y-4 pt-4">
                      {/* Translation section */}
                      <Show when={showTranslation()}>
                        <div class="flex items-start gap-3">
                          <div class="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--color-accent-primary)' }}>
                            <TranslateIcon />
                          </div>
                          <div class="text-lg leading-relaxed text-primary break-words flex-1">
                            {props.lyric.translatedText || (
                              <Spinner size="sm" class="mt-1" />
                            )}
                          </div>
                        </div>
                      </Show>
                      
                      {/* Meaning explanation */}
                      <Show when={showAnnotations() && props.lyric.annotations && props.lyric.annotations.find(a => a.word === props.lyric.text && a.pronunciation === undefined)}>
                        <div class="flex items-start gap-3">
                          <div class="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--color-accent-primary)' }}>
                            <QuestionIcon />
                          </div>
                          <div class="flex-1">
                            <For each={props.lyric.annotations.filter(a => a.word === props.lyric.text && a.pronunciation === undefined)}>
                              {(annotation) => (
                                <MarkdownRenderer 
                                  content={annotation.meaning} 
                                  class="text-base leading-relaxed"
                                />
                              )}
                            </For>
                          </div>
                        </div>
                      </Show>
                      
                      {/* Grammar explanation */}
                      <Show when={showAnnotations() && props.lyric.annotations && props.lyric.annotations.find(a => a.word === props.lyric.text && a.pronunciation !== undefined)}>
                        <div class="flex items-start gap-3">
                          <div class="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--color-accent-primary)' }}>
                            <BookIcon />
                          </div>
                          <div class="flex-1">
                            <For each={props.lyric.annotations.filter(a => a.word === props.lyric.text && a.pronunciation !== undefined)}>
                              {(annotation) => (
                                <MarkdownRenderer 
                                  content={annotation.meaning} 
                                  class="text-base leading-relaxed"
                                />
                              )}
                            </For>
                          </div>
                        </div>
                      </Show>
                    </div>
                  </div>
                
                <Show when={props.onPractice}>
                  <Button
                    variant="primary"
                    size="lg"
                    fullWidth
                    onClick={() => props.onPractice?.(props.lyric.text)}
                    class="mt-4"
                  >
                    <svg viewBox="0 0 24 24" class="w-5 h-5 mr-2" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                      <line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                    {t('karaoke.lyricDetail.practiceThisLine')}
                  </Button>
                </Show>
                </div>
                
                {/* Sticky bottom button container */}
                <div class="px-6 pb-6">
                  <div class="flex flex-col gap-2">
                    <button
                      onClick={handleExplainMeaning}
                      disabled={props.isLoading}
                      class={cn(
                        'w-full inline-flex items-center justify-center',
                        'h-12 px-4 text-base font-medium rounded-lg',
                        'bg-surface text-primary border border-default',
                        'hover:bg-elevated hover:border-strong transition-all',
                        'disabled:cursor-not-allowed disabled:opacity-50'
                      )}
                    >
                      {t('karaoke.lyricDetail.explainMeaning', 'Explain meaning')}
                    </button>
                    <button
                      onClick={handleExplainGrammar}
                      disabled={props.isLoading}
                      class={cn(
                        'w-full inline-flex items-center justify-center',
                        'h-12 px-4 text-base font-medium rounded-lg',
                        'bg-surface text-primary border border-default',
                        'hover:bg-elevated hover:border-strong transition-all',
                        'disabled:cursor-not-allowed disabled:opacity-50'
                      )}
                    >
                      {t('karaoke.lyricDetail.explainGrammar', 'Explain grammar')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Show>
      </Transition>
    </Portal>
  );
};
