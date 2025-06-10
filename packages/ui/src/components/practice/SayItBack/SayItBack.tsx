import { Show, createSignal } from 'solid-js';
import type { Component } from 'solid-js';
import { Button } from '../../common/Button';
import IconSpeakerHighRegular from 'phosphor-icons-solid/IconSpeakerHighRegular';
import { cn } from '../../../utils/cn';

export interface SayItBackProps {
  prompt: string;
  audioUrl?: string;
  isPlaying?: boolean;
  userTranscript?: string;
  isCorrect?: boolean;
  onPlayAudio?: () => void;
  onRecord?: () => void;
  onStop?: () => void;
  onSubmit?: () => void;
  isRecording?: boolean;
  isProcessing?: boolean;
  canSubmit?: boolean;
  class?: string;
}

export const SayItBack: Component<SayItBackProps> = (props) => {
  const [hasPlayed, setHasPlayed] = createSignal(false);
  
  const handlePlayAudio = () => {
    setHasPlayed(true);
    props.onPlayAudio?.();
  };
  
  return (
    <div class={cn('space-y-6', props.class)}>
      <p class="text-xl md:text-2xl text-left">
        {props.prompt}
      </p>
      
      <div class="flex justify-start">
        <Button
          variant={hasPlayed() ? 'secondary' : 'primary'}
          size="lg"
          onClick={handlePlayAudio}
          disabled={props.isPlaying}
          class="min-w-[140px]"
        >
          <IconSpeakerHighRegular size={24} class="mr-2" />
          {props.isPlaying ? 'Playing...' : hasPlayed() ? 'Play Again' : 'Play'}
        </Button>
      </div>
      
      <Show when={props.userTranscript}>
        <div class={cn(
          'rounded-lg p-4 transition-colors',
          props.isCorrect === true && 'bg-green-500/20 border border-green-500/40',
          props.isCorrect === false && 'bg-red-500/20 border border-red-500/40',
          props.isCorrect === undefined && 'bg-highlight'
        )}>
          <p class="text-sm text-secondary mb-1">Your response:</p>
          <p class="text-lg font-medium text-primary">
            {props.userTranscript}
          </p>
        </div>
      </Show>
    </div>
  );
};