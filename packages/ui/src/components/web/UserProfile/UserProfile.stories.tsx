import type { Meta, StoryObj } from '@storybook/html';
import { UserProfile, type UserProfileProps } from './UserProfile';
import { solidStory } from '../../../utils/storybook';

const meta: Meta<UserProfileProps> = {
  title: 'Web/UserProfile',
  render: solidStory(UserProfile),
  argTypes: {
    fid: {
      control: { type: 'number' },
    },
    username: {
      control: { type: 'text' },
    },
    displayName: {
      control: { type: 'text' },
    },
    pfpUrl: {
      control: { type: 'text' },
    },
    credits: {
      control: { type: 'number' },
    },
    compact: {
      control: 'boolean',
    },
  },
};

export default meta;
type Story = StoryObj<UserProfileProps>;

export const Default: Story = {
  args: {
    fid: 3621,
    username: 'alice',
    displayName: 'Alice',
    pfpUrl: 'https://i.pravatar.cc/150?u=alice',
    credits: 500,
  },
};

export const Compact: Story = {
  args: {
    fid: 3621,
    username: 'alice',
    displayName: 'Alice',
    pfpUrl: 'https://i.pravatar.cc/150?u=alice',
    credits: 500,
    compact: true,
  },
};

export const NoAvatar: Story = {
  args: {
    fid: 1234,
    username: 'bob',
    displayName: 'Bob Smith',
    credits: 250,
  },
};

export const AnonymousUser: Story = {
  args: {
    credits: 0,
  },
};

export const NoCredits: Story = {
  args: {
    fid: 5678,
    username: 'carol',
    displayName: 'Carol Johnson',
    pfpUrl: 'https://i.pravatar.cc/150?u=carol',
  },
};

export const UserList: Story = {
  render: () => {
    const container = document.createElement('div');
    container.className = 'space-y-2 bg-surface rounded-lg border border-subtle p-2';
    
    const users = [
      { fid: 1, username: 'dwr', displayName: 'Dan Romero', credits: 1200 },
      { fid: 2, username: 'vitalik', displayName: 'Vitalik Buterin', credits: 950 },
      { fid: 3, username: 'jessepollak', displayName: 'Jesse Pollak', credits: 750 },
    ];
    
    users.forEach((user, i) => {
      container.appendChild(solidStory(UserProfile)({
        ...user,
        pfpUrl: `https://i.pravatar.cc/150?u=${user.username}`,
        compact: true,
        class: i !== users.length - 1 ? 'border-b border-subtle' : '',
      }));
    });
    
    return container;
  },
};