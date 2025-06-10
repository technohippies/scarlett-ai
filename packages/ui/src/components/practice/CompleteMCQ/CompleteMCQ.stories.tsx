import type { Meta, StoryObj } from '@storybook/html';

// Props for demo stories
interface DemoProps {}
import { render } from 'solid-js/web';
import { createSignal } from 'solid-js';
import { ProgressBar } from '../../common/ProgressBar';
import { PracticeHeader } from '../PracticeHeader';
import { ExerciseTemplate } from '../ExerciseTemplate';
import { MCQ } from '../MCQ';
import { ResponseFooter } from '../ResponseFooter';

const meta: Meta<DemoProps> = {
  title: 'Practice/CompleteMCQ',
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<DemoProps>;

const sampleOptions = [
  { id: 'a', text: 'Bonjour, comment allez-vous?' },
  { id: 'b', text: 'Hola, ¿cómo estás?' },
  { id: 'c', text: 'Hello, how are you?' },
  { id: 'd', text: 'Guten Tag, wie geht es Ihnen?' },
];

const CompleteMCQDemo = () => {
  const [selectedOption, setSelectedOption] = createSignal<string | number | undefined>();
  const [isCorrect, setIsCorrect] = createSignal<boolean | undefined>();
  const [showFeedback, setShowFeedback] = createSignal(false);
  
  const handleMCQComplete = (selectedId: string | number, correct: boolean) => {
    setSelectedOption(selectedId);
    setIsCorrect(correct);
    setShowFeedback(true);
  };
  
  const handleContinue = () => {
    console.log('Continue to next exercise');
    // Reset for demo purposes
    setSelectedOption(undefined);
    setIsCorrect(undefined);
    setShowFeedback(false);
  };
  
  const getCorrectAnswerText = () => {
    const correctOption = sampleOptions.find(opt => opt.id === 'a');
    return correctOption?.text;
  };
  
  return (
    <div class="min-h-screen bg-base flex flex-col">
      <ProgressBar current={2} total={10} />
      
      <PracticeHeader 
        title="Practice" 
        onExit={() => console.log('Exit practice')} 
      />
      
      <main class="flex-1">
        <ExerciseTemplate instructionText="Choose the correct translation:">
          <MCQ
            question='How do you say "Hello, how are you?" in French?'
            options={sampleOptions}
            correctOptionId="a"
            onComplete={handleMCQComplete}
          />
        </ExerciseTemplate>
      </main>
      
      {showFeedback() && (
        <ResponseFooter
          mode="feedback"
          isCorrect={isCorrect()}
          feedbackText={!isCorrect() ? getCorrectAnswerText() : undefined}
          onContinue={handleContinue}
        />
      )}
    </div>
  );
};

export const Default: Story = {
  render: () => {
    const container = document.createElement('div');
    render(() => <CompleteMCQDemo />, container);
    return container;
  },
};

export const BeforeFeedback: Story = {
  render: () => {
    const container = document.createElement('div');
    render(() => (
      <div class="min-h-screen bg-base flex flex-col">
        <ProgressBar current={2} total={10} />
        
        <PracticeHeader 
          title="Practice" 
          onExit={() => console.log('Exit practice')} 
        />
        
        <main class="flex-1">
          <ExerciseTemplate instructionText="Choose the correct translation:">
            <MCQ
              question='How do you say "Hello, how are you?" in French?'
              options={sampleOptions}
              correctOptionId="a"
              onComplete={(id: string | number, correct: boolean) => console.log('Selected:', id, 'Correct:', correct)}
            />
          </ExerciseTemplate>
        </main>
      </div>
    ), container);
    return container;
  },
};

export const CorrectFeedback: Story = {
  render: () => {
    const container = document.createElement('div');
    render(() => (
      <div class="min-h-screen bg-base flex flex-col">
        <ProgressBar current={2} total={10} />
        
        <PracticeHeader 
          title="Practice" 
          onExit={() => console.log('Exit practice')} 
        />
        
        <main class="flex-1">
          <ExerciseTemplate instructionText="Choose the correct translation:">
            <div class="space-y-6">
              <p class="text-xl md:text-2xl text-left">
                How do you say "Hello, how are you?" in French?
              </p>
              <div class="grid grid-cols-1 gap-3">
                <button class="inline-flex items-center justify-center font-medium transition-all cursor-pointer border-none outline-none disabled:cursor-not-allowed disabled:opacity-50 bg-surface text-primary border border-default hover:bg-elevated hover:border-strong h-14 px-4 text-base rounded-lg gap-2 w-full justify-start text-lg pl-4 border-2 border-green-500 bg-green-500/10" disabled>
                  Bonjour, comment allez-vous?
                </button>
                <button class="inline-flex items-center justify-center font-medium transition-all cursor-pointer border-none outline-none disabled:cursor-not-allowed disabled:opacity-50 bg-surface text-primary border border-default hover:bg-elevated hover:border-strong h-14 px-4 text-base rounded-lg gap-2 w-full justify-start text-lg pl-4 opacity-50" disabled>
                  Hola, ¿cómo estás?
                </button>
                <button class="inline-flex items-center justify-center font-medium transition-all cursor-pointer border-none outline-none disabled:cursor-not-allowed disabled:opacity-50 bg-surface text-primary border border-default hover:bg-elevated hover:border-strong h-14 px-4 text-base rounded-lg gap-2 w-full justify-start text-lg pl-4 opacity-50" disabled>
                  Hello, how are you?
                </button>
                <button class="inline-flex items-center justify-center font-medium transition-all cursor-pointer border-none outline-none disabled:cursor-not-allowed disabled:opacity-50 bg-surface text-primary border border-default hover:bg-elevated hover:border-strong h-14 px-4 text-base rounded-lg gap-2 w-full justify-start text-lg pl-4 opacity-50" disabled>
                  Guten Tag, wie geht es Ihnen?
                </button>
              </div>
            </div>
          </ExerciseTemplate>
        </main>
        
        <ResponseFooter
          mode="feedback"
          isCorrect={true}
          onContinue={() => console.log('Continue')}
        />
      </div>
    ), container);
    return container;
  },
};

export const IncorrectFeedback: Story = {
  render: () => {
    const container = document.createElement('div');
    render(() => (
      <div class="min-h-screen bg-base flex flex-col">
        <ProgressBar current={2} total={10} />
        
        <PracticeHeader 
          title="Practice" 
          onExit={() => console.log('Exit practice')} 
        />
        
        <main class="flex-1">
          <ExerciseTemplate instructionText="Choose the correct translation:">
            <div class="space-y-6">
              <p class="text-xl md:text-2xl text-left">
                How do you say "Hello, how are you?" in French?
              </p>
              <div class="grid grid-cols-1 gap-3">
                <button class="inline-flex items-center justify-center font-medium transition-all cursor-pointer border-none outline-none disabled:cursor-not-allowed disabled:opacity-50 bg-surface text-primary border border-default hover:bg-elevated hover:border-strong h-14 px-4 text-base rounded-lg gap-2 w-full justify-start text-lg pl-4 border-2 border-green-500 bg-green-500/10" disabled>
                  Bonjour, comment allez-vous?
                </button>
                <button class="inline-flex items-center justify-center font-medium transition-all cursor-pointer border-none outline-none disabled:cursor-not-allowed disabled:opacity-50 bg-surface text-primary border border-default hover:bg-elevated hover:border-strong h-14 px-4 text-base rounded-lg gap-2 w-full justify-start text-lg pl-4 border-2 border-red-500 bg-red-500/10" disabled>
                  Hola, ¿cómo estás?
                </button>
                <button class="inline-flex items-center justify-center font-medium transition-all cursor-pointer border-none outline-none disabled:cursor-not-allowed disabled:opacity-50 bg-surface text-primary border border-default hover:bg-elevated hover:border-strong h-14 px-4 text-base rounded-lg gap-2 w-full justify-start text-lg pl-4 opacity-50" disabled>
                  Hello, how are you?
                </button>
                <button class="inline-flex items-center justify-center font-medium transition-all cursor-pointer border-none outline-none disabled:cursor-not-allowed disabled:opacity-50 bg-surface text-primary border border-default hover:bg-elevated hover:border-strong h-14 px-4 text-base rounded-lg gap-2 w-full justify-start text-lg pl-4 opacity-50" disabled>
                  Guten Tag, wie geht es Ihnen?
                </button>
              </div>
              <div class="text-sm text-secondary">
                Correct answer: Bonjour, comment allez-vous?
              </div>
            </div>
          </ExerciseTemplate>
        </main>
        
        <ResponseFooter
          mode="feedback"
          isCorrect={false}
          feedbackText="Bonjour, comment allez-vous?"
          continueLabel="Try again"
          onContinue={() => console.log('Continue')}
        />
      </div>
    ), container);
    return container;
  },
};

export const MobileLayout: Story = {
  render: () => {
    const container = document.createElement('div');
    const wrapper = document.createElement('div');
    wrapper.className = 'w-full max-w-[420px] mx-auto';
    
    render(() => <CompleteMCQDemo />, container);
    
    wrapper.appendChild(container);
    return wrapper;
  },
};