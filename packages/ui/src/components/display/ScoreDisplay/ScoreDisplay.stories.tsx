import type { Meta, StoryObj } from 'storybook-solidjs';
import { ScoreDisplay } from './ScoreDisplay';

const meta: Meta<typeof ScoreDisplay> = {
  title: 'Display/ScoreDisplay',
  component: ScoreDisplay,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    score: {
      control: { type: 'range', min: 0, max: 100, step: 1 },
      description: 'Current score value',
    },
    maxScore: {
      control: { type: 'number', min: 10, max: 1000 },
      description: 'Maximum possible score',
    },
    variant: {
      control: 'select',
      options: ['default', 'large', 'compact', 'animated'],
      description: 'Display variant',
    },
    showPercentage: {
      control: 'boolean',
      description: 'Show percentage value',
    },
    showGrade: {
      control: 'boolean',
      description: 'Show letter grade',
    },
    animate: {
      control: 'boolean',
      description: 'Animate score counting up',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    score: 85,
    maxScore: 100,
  },
};

export const WithGrade: Story = {
  args: {
    score: 92,
    maxScore: 100,
    showGrade: true,
  },
};

export const WithPercentage: Story = {
  args: {
    score: 78,
    maxScore: 100,
    showPercentage: true,
  },
};

export const Large: Story = {
  args: {
    score: 95,
    maxScore: 100,
    variant: 'large',
    showGrade: true,
    showPercentage: true,
  },
};

export const Compact: Story = {
  args: {
    score: 45,
    maxScore: 50,
    variant: 'compact',
  },
};

export const Animated: Story = {
  args: {
    score: 88,
    maxScore: 100,
    variant: 'animated',
    animate: true,
    showGrade: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Score counts up with animation and progress bar',
      },
    },
  },
};

export const CustomMaxScore: Story = {
  args: {
    score: 425,
    maxScore: 500,
    showPercentage: true,
    showGrade: true,
  },
};

export const WithPrefixSuffix: Story = {
  args: {
    score: 1250,
    prefix: '🏆 ',
    suffix: ' pts',
    variant: 'large',
  },
};

export const GradeShowcase: Story = {
  render: () => (
    <div class="space-y-8">
      <div class="grid grid-cols-3 gap-6">
        <div class="text-center">
          <ScoreDisplay score={98} showGrade animate />
          <p class="text-sm text-secondary mt-2">S Grade (95%+)</p>
        </div>
        <div class="text-center">
          <ScoreDisplay score={92} showGrade animate />
          <p class="text-sm text-secondary mt-2">A+ Grade (90%+)</p>
        </div>
        <div class="text-center">
          <ScoreDisplay score={85} showGrade animate />
          <p class="text-sm text-secondary mt-2">A Grade (85%+)</p>
        </div>
        <div class="text-center">
          <ScoreDisplay score={78} showGrade animate />
          <p class="text-sm text-secondary mt-2">B+ Grade (80%+)</p>
        </div>
        <div class="text-center">
          <ScoreDisplay score={72} showGrade animate />
          <p class="text-sm text-secondary mt-2">C+ Grade (70%+)</p>
        </div>
        <div class="text-center">
          <ScoreDisplay score={55} showGrade animate />
          <p class="text-sm text-secondary mt-2">F Grade (<60%)</p>
        </div>
      </div>
    </div>
  ),
};

export const KaraokeSession: Story = {
  render: () => (
    <div class="bg-surface p-8 rounded-xl text-center space-y-6">
      <h2 class="text-2xl font-bold text-primary">🎤 Performance Complete!</h2>
      <ScoreDisplay 
        score={87} 
        variant="animated" 
        animate 
        showGrade 
        showPercentage 
      />
      <div class="flex justify-center gap-8 text-sm">
        <div>
          <p class="text-muted">Accuracy</p>
          <p class="text-lg font-semibold text-primary">92%</p>
        </div>
        <div>
          <p class="text-muted">Timing</p>
          <p class="text-lg font-semibold text-primary">85%</p>
        </div>
        <div>
          <p class="text-muted">Pitch</p>
          <p class="text-lg font-semibold text-primary">83%</p>
        </div>
      </div>
    </div>
  ),
};