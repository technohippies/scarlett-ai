import { Show } from 'solid-js';
import type { Component } from 'solid-js';
import { Button } from '../../common/Button';
import { cn } from '../../../utils/cn';

export interface ExerciseFooterProps {
  isRecording?: boolean;
  isProcessing?: boolean;
  canSubmit?: boolean;
  onRecord?: () => void;
  onStop?: () => void;
  onSubmit?: () => void;
  class?: string;
}

export const ExerciseFooter: Component<ExerciseFooterProps> = (props) => {
  return (
    <footer class={cn('border-t border-gray-700 bg-surface p-6', props.class)}>
      <div class="max-w-2xl mx-auto">
        <Show
          when={!props.isRecording}
          fallback={
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={props.onStop}
              disabled={props.isProcessing}
            >
              Stop
            </Button>
          }
        >
          <Show
            when={props.canSubmit}
            fallback={
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={props.onRecord}
                disabled={props.isProcessing}
              >
                Record
              </Button>
            }
          >
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={props.onSubmit}
              disabled={props.isProcessing}
            >
              {props.isProcessing ? 'Processing...' : 'Submit'}
            </Button>
          </Show>
        </Show>
      </div>
    </footer>
  );
};