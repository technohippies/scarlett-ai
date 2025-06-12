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
      <div class="max-w-2xl mx-auto">
        <Show
          when={props.mode === 'check'}
          fallback={
            <div class="flex items-center justify-between gap-6">
            <Show when={props.isCorrect !== undefined}>
              <div class="flex items-center gap-4">
                <Show
                  when={props.isCorrect}
                  fallback={<IconXCircleFill style="color: #ef4444;" class="w-16 h-16 flex-shrink-0" />}
                >
                  <IconCheckCircleFill style="color: #22c55e;" class="w-16 h-16 flex-shrink-0" />
                </Show>
                <div>
                  <p class="text-2xl font-bold" style={`color: ${props.isCorrect ? '#22c55e' : '#ef4444'};`}>
                    {props.isCorrect ? 'Correct!' : 'Incorrect'}
                  </p>
                  <Show when={props.feedbackText && !props.isCorrect}>
                    <p class="text-base text-secondary mt-1">{props.feedbackText}</p>
                  </Show>
                </div>
              </div>
            </Show>
            <Button
              variant="primary"
              size="lg"
              onClick={props.onContinue}
              class="min-w-[180px]"
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
    </div>
  );
};