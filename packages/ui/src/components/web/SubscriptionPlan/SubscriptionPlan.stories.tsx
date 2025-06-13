import type { Meta, StoryObj } from '@storybook/html';
import type { SubscriptionPlanProps } from './SubscriptionPlan';
import { SubscriptionPlan } from './SubscriptionPlan';
import { solidStory } from '../../../utils/storybook';
import { withI18n } from '../../../utils/i18n-story';

const meta: Meta<SubscriptionPlanProps> = {
  title: 'Web/SubscriptionPlan',
  render: (args, context) => withI18n(SubscriptionPlan)(args, context),
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    isActive: { control: 'boolean' },
    hasTrialAvailable: { control: 'boolean' },
    disabled: { control: 'boolean' },
    isConnected: { control: 'boolean' },
    walletAddress: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<SubscriptionPlanProps>;

export const TrialAvailable: Story = {
  args: {
    hasTrialAvailable: true,
    onSubscribe: () => console.log('Subscribe clicked'),
  },
};

export const NoTrial: Story = {
  args: {
    hasTrialAvailable: false,
    onSubscribe: () => console.log('Subscribe clicked'),
  },
};

export const ActiveSubscription: Story = {
  args: {
    isActive: true,
    onManage: () => console.log('Manage clicked'),
  },
};

export const Disabled: Story = {
  args: {
    hasTrialAvailable: true,
    disabled: true,
    onSubscribe: () => console.log('Subscribe clicked'),
  },
};

export const NotConnected: Story = {
  args: {
    isConnected: false,
    onConnectWallet: () => console.log('Connect wallet clicked'),
  },
};

export const ConnectedWithWallet: Story = {
  args: {
    isConnected: true,
    walletAddress: '0x1234567890123456789012345678901234567890',
    hasTrialAvailable: false,
    onSubscribe: () => console.log('Subscribe with Unlock clicked'),
  },
};

export const ConnectedWithTrial: Story = {
  args: {
    isConnected: true,
    walletAddress: '0x1234567890123456789012345678901234567890',
    hasTrialAvailable: true,
    onSubscribe: () => console.log('Start free trial clicked'),
  },
};

export const InModal: Story = {
  render: (args, context) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'w-full max-w-md bg-base p-6 rounded-lg';
    
    const component = withI18n(SubscriptionPlan)({
      hasTrialAvailable: true,
      onSubscribe: () => console.log('Subscribe clicked'),
      ...args
    }, context);
    
    if (component instanceof Node) {
      wrapper.appendChild(component);
    }
    return wrapper;
  },
};