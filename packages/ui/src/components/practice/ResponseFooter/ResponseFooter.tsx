import type { Component } from 'solid-js';
import { Show } from 'solid-js';
import { Button } from '../../common/Button';
import IconCheckCircleFill from 'phosphor-icons-solid/IconCheckCircleFill';
import IconXCircleFill from 'phosphor-icons-solid/IconXCircleFill';

export interface ResponseFooterProps {
  mode: 'check' | 'feedback';
  isCorrect?: boolean;
  feedbackText?: string;
  continueLabel?: string;
  onCheck?: () => void;
  onContinue?: () => void;
}

export const ResponseFooter: Component<ResponseFooterProps> = (props) => {
  return (
    <div class="border-t border-gray-700 bg-surface p-6">
      <Show
        when={props.mode === 'check'}
        fallback={
          <div class="flex items-center gap-4">
            <Show when={props.isCorrect !== undefined}>
              <div class="flex items-center gap-3">
                <Show
                  when={props.isCorrect}
                  fallback={<IconXCircleFill class="text-red-500 w-12 h-12" />}
                >
                  <IconCheckCircleFill class="text-green-500 w-12 h-12" />
                </Show>
                <div class="flex-1">
                  <p class={`font-semibold ${props.isCorrect ? 'text-green-500' : 'text-red-500'}`}>
                    {props.isCorrect ? 'Correct!' : 'Incorrect'}
                  </p>
                  <Show when={props.feedbackText && !props.isCorrect}>
                    <p class="text-sm text-secondary mt-1">{props.feedbackText}</p>
                  </Show>
                </div>
              </div>
            </Show>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={props.onContinue}
            >
              {props.continueLabel || 'Next'}
            </Button>
          </div>
        }
      >
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={props.onCheck}
        >
          Check
        </Button>
      </Show>
    </div>
  );
};