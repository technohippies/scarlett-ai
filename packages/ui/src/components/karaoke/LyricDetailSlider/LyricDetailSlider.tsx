import type { Component } from 'solid-js';
import { Show, createEffect, onCleanup, createSignal, For } from 'solid-js';
import { Portal } from 'solid-js/web';
import { Transition } from 'solid-transition-group';
import { Button } from '../../common/Button';
import { TextEffect } from '../../common/TextEffect';
import { cn } from '../../../utils/cn';
import { useI18n } from '../../../i18n';

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
  onAnnotate: () => void;
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
  
  const handleExplain = () => {
    setShowAnnotations(true);
    props.onAnnotate();
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
                  {/* Use CSS Grid for fixed layout */}
                  <div style="display: grid; grid-template-rows: auto auto 150px; gap: 1rem;">
                    {/* Original lyric - auto height */}
                    <div class="text-xl leading-relaxed text-primary break-words">
                      {props.lyric.text}
                    </div>
                    
                    {/* Romanization - auto height */}
                    <div class="text-base text-secondary italic break-words" style="min-height: 0;">
                      {props.lyric.romanization || ''}
                    </div>
                    
                    {/* Translation - FIXED 150px height */}
                    <div class="text-xl leading-relaxed text-primary break-words overflow-y-auto">
                      <Show when={showTranslation()}>
                        {props.lyric.translatedText || (
                          <div class="pt-4">
                            <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-accent-primary"></div>
                          </div>
                        )}
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
                
                {/* Annotations - improved design */}
                <Show when={showAnnotations() && props.lyric.annotations && props.lyric.annotations.length > 0}>
                    <div class="space-y-3 pt-4">
                      <h3 class="text-xs font-semibold text-tertiary uppercase tracking-wider">
                        {t('karaoke.lyricDetail.annotations')}
                      </h3>
                      <div class="space-y-3">
                        <For each={props.lyric.annotations}>
                          {(annotation) => (
                            <div class="bg-surface rounded-lg p-3 space-y-1">
                              <div class="flex items-baseline gap-2">
                                <span class="font-semibold text-primary">
                                  {annotation.word}
                                </span>
                                <Show when={annotation.pronunciation}>
                                  <span class="text-sm text-secondary">
                                    [{annotation.pronunciation}]
                                  </span>
                                </Show>
                              </div>
                              <div class="text-sm text-secondary">
                                {annotation.meaning}
                              </div>
                            </div>
                          )}
                        </For>
                      </div>
                    </div>
                  </Show>
                </div>
                
                {/* Sticky bottom button container */}
                <div class="px-6 pb-8">
                  <Show when={!showAnnotations() || !props.lyric.annotations}>
                    <button
                      onClick={handleExplain}
                      disabled={props.isLoading}
                      class={cn(
                        'w-full inline-flex items-center justify-center',
                        'h-12 px-6 text-lg font-medium rounded-lg',
                        'bg-surface text-primary',
                        'hover:bg-elevated transition-all',
                        'disabled:cursor-not-allowed disabled:opacity-50',
                        props.isLoading && 'cursor-wait'
                      )}
                    >
                      <Show when={props.isLoading && !props.lyric.annotations}>
                        <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-current mr-2" />
                      </Show>
                      {t('karaoke.lyricDetail.explain', 'Explain')}
                    </button>
                  </Show>
                </div>
              </div>
            </div>
          </div>
        </Show>
      </Transition>
    </Portal>
  );
};
