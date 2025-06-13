import type { Meta, StoryObj } from '@storybook/html';
import { AuthButton, type AuthButtonProps } from './AuthButton';
import { withI18n } from '../../../utils/i18n-story';

const meta: Meta<AuthButtonProps> = {
  title: 'Web/AuthButton',
  render: (args, context) => withI18n(AuthButton)(args, context),
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'ghost'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    isLoading: {
      control: 'boolean',
    },
  },
};

export default meta;
type Story = StoryObj<AuthButtonProps>;

export const NotAuthenticated: Story = {
  args: {
    onSignInClick: () => console.log('Sign in clicked'),
  },
};

export const AuthenticatedWithFarcaster: Story = {
  args: {
    user: {
      username: 'vitalik.eth',
      avatarUrl: 'https://i.imgur.com/KFfLXkA.jpg',
      credits: 1234,
    },
    onSignOutClick: () => console.log('Sign out clicked'),
  },
};

export const AuthenticatedWithWallet: Story = {
  args: {
    user: {
      address: '0x742d35Cc6634C0532925a3b844Bc9e7595f8fA72',
      credits: 567,
    },
    onSignOutClick: () => console.log('Sign out clicked'),
  },
};

export const AuthenticatedNoCredits: Story = {
  args: {
    user: {
      username: 'user123',
      avatarUrl: 'https://i.imgur.com/dMoIan7.jpg',
      credits: 0,
    },
    onSignOutClick: () => console.log('Sign out clicked'),
  },
};

export const Loading: Story = {
  args: {
    isLoading: true,
  },
};

export const SmallSize: Story = {
  args: {
    size: 'sm',
    onSignInClick: () => console.log('Sign in clicked'),
  },
};

export const SecondaryVariant: Story = {
  args: {
    variant: 'secondary',
    onSignInClick: () => console.log('Sign in clicked'),
  },
};

export const GhostVariant: Story = {
  args: {
    variant: 'ghost',
    onSignInClick: () => console.log('Sign in clicked'),
  },
};