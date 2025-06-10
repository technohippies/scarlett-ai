import type { Meta, StoryObj } from '@storybook/html';

// Props for demo stories
interface DemoProps {}
import { render } from 'solid-js/web';
import { createSignal } from 'solid-js';
import { ProgressBar } from '../../common/ProgressBar';
import { PracticeHeader } from '../PracticeHeader';
import { ExerciseTemplate } from '../ExerciseTemplate';
import { ReadAloud } from '../ReadAloud';
import { ExerciseFooter } from '../ExerciseFooter';

const meta: Meta<DemoProps> = {
  title: 'Practice/CompleteReadAloud',
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<DemoProps>;

const CompleteReadAloudDemo = () => {
  const [isRecording, setIsRecording] = createSignal(false);
  const [isProcessing, setIsProcessing] = createSignal(false);
  const [userTranscript, setUserTranscript] = createSignal('');
  
  const handleRecord = () => {
    setIsRecording(true);
    setUserTranscript('');
  };
  
  const handleStop = () => {
    setIsRecording(false);
    setIsProcessing(true);
    
    // Simulate processing
    setTimeout(() => {
      setUserTranscript('The quick brown fox jumps over the lazy dog');
      setIsProcessing(false);
    }, 1500);
  };
  
  const handleSubmit = () => {
    console.log('Submit:', userTranscript());
  };
  
  return (
    <div class="min-h-screen bg-base flex flex-col">
      <ProgressBar current={3} total={10} />
      
      <PracticeHeader 
        title="Practice" 
        onExit={() => console.log('Exit practice')} 
      />
      
      <main class="flex-1">
        <ExerciseTemplate instructionText="Read aloud:">
          <ReadAloud
            prompt="The quick brown fox jumps over the lazy dog"
            userTranscript={userTranscript()}
          />
        </ExerciseTemplate>
      </main>
      
      <ExerciseFooter
        isRecording={isRecording()}
        isProcessing={isProcessing()}
        canSubmit={userTranscript().trim().length > 0}
        onRecord={handleRecord}
        onStop={handleStop}
        onSubmit={handleSubmit}
      />
    </div>
  );
};

export const Default: Story = {
  render: () => {
    const container = document.createElement('div');
    render(() => <CompleteReadAloudDemo />, container);
    return container;
  },
};

export const Recording: Story = {
  render: () => {
    const container = document.createElement('div');
    render(() => {
      const [isRecording] = createSignal(true);
      const [isProcessing] = createSignal(false);
      const [userTranscript] = createSignal('');
      
      return (
        <div class="min-h-screen bg-base flex flex-col">
          <ProgressBar current={3} total={10} />
          
          <PracticeHeader 
            title="Practice" 
            onExit={() => console.log('Exit practice')} 
          />
          
          <main class="flex-1">
            <ExerciseTemplate instructionText="Read aloud:">
              <ReadAloud
                prompt="The quick brown fox jumps over the lazy dog"
                userTranscript={userTranscript()}
              />
            </ExerciseTemplate>
          </main>
          
          <ExerciseFooter
            isRecording={isRecording()}
            isProcessing={isProcessing()}
            canSubmit={false}
            onRecord={() => console.log('Record')}
            onStop={() => console.log('Stop')}
            onSubmit={() => console.log('Submit')}
          />
        </div>
      );
    }, container);
    return container;
  },
};

export const WithTranscript: Story = {
  render: () => {
    const container = document.createElement('div');
    render(() => {
      const [isRecording] = createSignal(false);
      const [isProcessing] = createSignal(false);
      const [userTranscript] = createSignal('The quick brown fox jumps over the lazy dog');
      
      return (
        <div class="min-h-screen bg-base flex flex-col">
          <ProgressBar current={3} total={10} />
          
          <PracticeHeader 
            title="Practice" 
            onExit={() => console.log('Exit practice')} 
          />
          
          <main class="flex-1">
            <ExerciseTemplate instructionText="Read aloud:">
              <ReadAloud
                prompt="The quick brown fox jumps over the lazy dog"
                userTranscript={userTranscript()}
              />
            </ExerciseTemplate>
          </main>
          
          <ExerciseFooter
            isRecording={isRecording()}
            isProcessing={isProcessing()}
            canSubmit={true}
            onRecord={() => console.log('Record')}
            onStop={() => console.log('Stop')}
            onSubmit={() => console.log('Submit')}
          />
        </div>
      );
    }, container);
    return container;
  },
};

export const Processing: Story = {
  render: () => {
    const container = document.createElement('div');
    render(() => {
      const [isRecording] = createSignal(false);
      const [isProcessing] = createSignal(true);
      const [userTranscript] = createSignal('');
      
      return (
        <div class="min-h-screen bg-base flex flex-col">
          <ProgressBar current={3} total={10} />
          
          <PracticeHeader 
            title="Practice" 
            onExit={() => console.log('Exit practice')} 
          />
          
          <main class="flex-1">
            <ExerciseTemplate instructionText="Read aloud:">
              <ReadAloud
                prompt="The quick brown fox jumps over the lazy dog"
                userTranscript={userTranscript()}
              />
            </ExerciseTemplate>
          </main>
          
          <ExerciseFooter
            isRecording={isRecording()}
            isProcessing={isProcessing()}
            canSubmit={false}
            onRecord={() => console.log('Record')}
            onStop={() => console.log('Stop')}
            onSubmit={() => console.log('Submit')}
          />
        </div>
      );
    }, container);
    return container;
  },
};

export const MobileLayout: Story = {
  render: () => {
    const container = document.createElement('div');
    const wrapper = document.createElement('div');
    wrapper.className = 'w-full max-w-[420px] mx-auto';
    
    render(() => <CompleteReadAloudDemo />, container);
    
    wrapper.appendChild(container);
    return wrapper;
  },
};