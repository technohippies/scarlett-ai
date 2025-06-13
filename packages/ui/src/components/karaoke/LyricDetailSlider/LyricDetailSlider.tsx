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
  targetLanguage?: 'en' | 'es';
  isLoading?: boolean;
  onClose: () => void;
  onTranslate: (targetLang: 'en' | 'es') => void;
  onAnnotate: () => void;
  onPractice?: (text: string) => void;
}

export const LyricDetailSlider: Component<LyricDetailSliderProps> = (props) => {
  const { t } = useI18n();
  const [showTranslation, setShowTranslation] = createSignal(false);
  const [showAnnotations, setShowAnnotations] = createSignal(false);
  const [selectedTargetLang, setSelectedTargetLang] = createSignal<'en' | 'es'>('es');
  
  // Auto-detect if we should translate to English or Spanish
  createEffect(() => {
    if (props.userLanguage?.startsWith('es')) {
      setSelectedTargetLang('en');
    } else {
      setSelectedTargetLang('es');
    }
  });
  
  // Reset states when slider opens/closes
  createEffect(() => {
    if (!props.isOpen) {
      setShowTranslation(false);
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
    if (props.isOpen && !props.lyric.translatedText) {
      setShowTranslation(true);
      props.onTranslate(selectedTargetLang());
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
            <div class="bg-elevated rounded-t-3xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
              {/* Handle bar */}
              <div class="flex justify-center pt-3 pb-2">
                <div class="w-12 h-1 bg-surface rounded-full" />
              </div>
              
              {/* Close button */}
              <div class="absolute top-4 right-4">
                <button
                  onClick={props.onClose}
                  class="p-2 rounded-lg bg-surface/50 hover:bg-surface transition-all hover:scale-110"
                  aria-label={t('lyricDetail.close')}
                >
                  <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div class="px-6 pb-8 space-y-6 overflow-y-auto overflow-x-hidden flex-1">
                {/* Lyrics stacked - left aligned */}
                <div class="space-y-4">
                  {/* Original lyric - same size as lyrics display */}
                  <div class="text-2xl leading-relaxed text-primary break-words">
                    {props.lyric.text}
                  </div>
                  
                  {/* Romanization if available */}
                  <Show when={props.lyric.romanization}>
                    <div class="text-lg text-secondary italic break-words">
                      {props.lyric.romanization}
                    </div>
                  </Show>
                  
                  {/* Translation - with TextEffect when loading */}
                  <Show when={showTranslation()}>
                    <div class="text-2xl leading-relaxed text-primary break-words">
                      <Show 
                        when={props.lyric.translatedText && props.lyric.translatedText.length > 0}
                        fallback={
                          <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-accent-primary"></div>
                        }
                      >
                        <TextEffect preset="fade" per="word">
                          {props.lyric.translatedText!}
                        </TextEffect>
                      </Show>
                    </div>
                  </Show>
                </div>
                
                {/* Single Explain button */}
                <Show when={!showAnnotations() || !props.lyric.annotations}>
                  <Button
                    variant="secondary"
                    size="lg"
                    onClick={handleExplain}
                    loading={props.isLoading && !props.lyric.annotations}
                    disabled={props.isLoading}
                    fullWidth
                  >
                    {t('lyricDetail.explain', 'Explain')}
                  </Button>
                </Show>
                
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
                    {t('lyricDetail.practiceThisLine')}
                  </Button>
                </Show>
                
                {/* Annotations - improved design */}
                <Show when={showAnnotations() && props.lyric.annotations && props.lyric.annotations.length > 0}>
                    <div class="space-y-3 pt-4">
                      <h3 class="text-xs font-semibold text-tertiary uppercase tracking-wider">
                        {t('lyricDetail.annotations')}
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
            </div>
          </div>
        </Show>
      </Transition>
    </Portal>
  );
};
