import { createSignal, For, Show } from 'solid-js';
import type { Component } from 'solid-js';
import { Button } from '../../common/Button';
import { cn } from '../../../utils/cn';
import { soundManager } from '../../../utils/sound';

export interface Option {
  id: string | number;
  text: string;
}

export interface MCQProps {
  question: string;
  options: Option[];
  correctOptionId: string | number;
  onComplete: (selectedOptionId: string | number, isCorrect: boolean) => void;
  class?: string;
}

export const MCQ: Component<MCQProps> = (props) => {
  const [selectedOptionId, setSelectedOptionId] = createSignal<string | number | undefined>();
  const [showFeedback, setShowFeedback] = createSignal(false);
  
  const isCorrect = () => selectedOptionId() === props.correctOptionId;
  
  const getCorrectAnswerText = () => {
    const correctOption = props.options.find(opt => opt.id === props.correctOptionId);
    return correctOption?.text;
  };
  
  const handleOptionClick = (optionId: string | number) => {
    if (showFeedback()) return;
    
    setSelectedOptionId(optionId);
    setShowFeedback(true);
    
    // Play appropriate sound
    if (optionId === props.correctOptionId) {
      soundManager.play('correct');
    } else {
      soundManager.play('incorrect');
    }
    
    // Small delay before calling onComplete to allow user to see feedback
    setTimeout(() => {
      props.onComplete(optionId, optionId === props.correctOptionId);
    }, 1500);
  };
  
  const getOptionVariant = (optionId: string | number): 'primary' | 'secondary' | 'ghost' | 'danger' => {
    if (!showFeedback()) {
      return selectedOptionId() === optionId ? 'secondary' : 'secondary';
    }
    
    // Show feedback colors
    if (optionId === props.correctOptionId) {
      return 'secondary'; // Will add green border class
    }
    if (selectedOptionId() === optionId && !isCorrect()) {
      return 'secondary'; // Will add red border class
    }
    return 'secondary';
  };
  
  const getOptionClass = (optionId: string | number) => {
    const baseClass = 'w-full justify-start h-14 text-lg pl-4';
    
    if (!showFeedback()) {
      return cn(
        baseClass, 
        'transition-all duration-200',
        selectedOptionId() === optionId && 'border-secondary'
      );
    }
    
    // Feedback state classes
    if (optionId === props.correctOptionId) {
      return cn(baseClass, 'border-2 border-green-500 bg-green-500/10');
    }
    if (selectedOptionId() === optionId && !isCorrect()) {
      return cn(baseClass, 'border-2 border-red-500 bg-red-500/10');
    }
    
    return cn(baseClass, 'opacity-50');
  };
  
  return (
    <div class={cn('space-y-6', props.class)}>
      <p class="text-xl md:text-2xl text-left">
        {props.question}
      </p>
      
      <div class="grid grid-cols-1 gap-3">
        <For each={props.options}>
          {(option) => (
            <Button
              variant={getOptionVariant(option.id)}
              class={cn(
                getOptionClass(option.id),
                !showFeedback() && 'hover:!bg-[#262626] hover:!border-[#525252]'
              )}
              onClick={() => handleOptionClick(option.id)}
              disabled={showFeedback()}
            >
              {option.text}
            </Button>
          )}
        </For>
      </div>
      
      <Show when={showFeedback() && !isCorrect()}>
        <div class="text-sm text-secondary">
          Correct answer: {getCorrectAnswerText()}
        </div>
      </Show>
    </div>
  );
};