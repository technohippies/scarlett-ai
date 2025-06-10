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
  class?: string;
}

export const SayItBack: Component<SayItBackProps> = (props) => {
  const [hasPlayed, setHasPlayed] = createSignal(false);
  
  const handlePlayAudio = () => {
    setHasPlayed(true);
    props.onPlayAudio?.();
  };
  
  return (
    <div class={cn('flex flex-col items-center justify-center min-h-[400px] p-6', props.class)}>
      <div class="text-center space-y-8 max-w-[500px]">
        <h2 class="text-2xl font-semibold text-primary">
          Say It Back
        </h2>
        
        <p class="text-lg text-secondary">
          Listen to the phrase and repeat it back
        </p>
        
        <div class="flex justify-center">
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
        
        <Show when={props.prompt}>
          <div class="bg-highlight rounded-lg p-4">
            <p class="text-lg font-medium text-primary">
              {props.prompt}
            </p>
          </div>
        </Show>
        
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
    </div>
  );
};