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
    <footer class={cn('fixed bottom-0 left-0 right-0 bg-base border-t border-secondary/20', props.class)}>
      <div class="p-4">
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