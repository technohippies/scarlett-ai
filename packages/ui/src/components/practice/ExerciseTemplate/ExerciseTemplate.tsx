import type { Component, JSX } from 'solid-js';
import { cn } from '../../../utils/cn';

export interface ExerciseTemplateProps {
  instructionText?: string;
  children: JSX.Element;
  class?: string;
}

export const ExerciseTemplate: Component<ExerciseTemplateProps> = (props) => {
  return (
    <div class={cn('flex flex-col h-full bg-base text-primary', props.class)}>
      <div class="flex-grow overflow-y-auto flex flex-col pb-24">
        <div class="w-full max-w-2xl mx-auto px-4 pt-6">
          {props.instructionText && (
            <p class="text-lg font-semibold mb-4 text-left">
              {props.instructionText}
            </p>
          )}
          {props.children}
        </div>
      </div>
    </div>
  );
};