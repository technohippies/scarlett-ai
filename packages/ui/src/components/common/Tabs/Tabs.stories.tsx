import type { Meta, StoryObj } from '@storybook/html';
import { Tabs, TabsList, TabsTrigger, TabsContent, type TabsProps } from './Tabs';
import { Card } from '../Card';
import { solidStory } from '../../../utils/storybook';

const meta: Meta<TabsProps> = {
  title: 'Common/Tabs',
  render: solidStory(Tabs),
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<TabsProps>;

export const Default: Story = {
  args: {
    tabs: [
      { id: 'lyrics', label: 'Lyrics' },
      { id: 'leaderboard', label: 'Leaderboard' }
    ],
    defaultTab: 'lyrics',
    children: (
      <>
        <TabsList>
          <TabsTrigger value="lyrics">Lyrics</TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
        </TabsList>
        <TabsContent value="lyrics">
          <Card class="p-6">
            <h3 class="text-lg font-semibold mb-2">Lyrics View</h3>
            <p class="text-secondary">Song lyrics would appear here</p>
          </Card>
        </TabsContent>
        <TabsContent value="leaderboard">
          <Card class="p-6">
            <h3 class="text-lg font-semibold mb-2">Leaderboard</h3>
            <p class="text-secondary">Top scores would appear here</p>
          </Card>
        </TabsContent>
      </>
    ),
  },
  decorators: [
    (Story) => {
      const container = document.createElement('div');
      container.className = 'w-full max-w-md';
      const storyElement = Story();
      if (typeof storyElement === 'string') {
        container.innerHTML = storyElement;
      } else {
        container.appendChild(storyElement);
      }
      return container;
    },
  ],
};

export const ThreeTabs: Story = {
  args: {
    tabs: [
      { id: 'account', label: 'Account' },
      { id: 'security', label: 'Security' },
      { id: 'notifications', label: 'Notifications' }
    ],
    defaultTab: 'account',
    children: (
      <>
        <TabsList>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>
        <TabsContent value="account">
          <Card class="p-6">
            <h3 class="text-lg font-semibold mb-2">Account Settings</h3>
            <p class="text-secondary">Manage your account details</p>
          </Card>
        </TabsContent>
        <TabsContent value="security">
          <Card class="p-6">
            <h3 class="text-lg font-semibold mb-2">Security Settings</h3>
            <p class="text-secondary">Update your security preferences</p>
          </Card>
        </TabsContent>
        <TabsContent value="notifications">
          <Card class="p-6">
            <h3 class="text-lg font-semibold mb-2">Notification Settings</h3>
            <p class="text-secondary">Configure your notifications</p>
          </Card>
        </TabsContent>
      </>
    ),
  },
  decorators: [
    (Story) => {
      const container = document.createElement('div');
      container.className = 'w-full max-w-md';
      const storyElement = Story();
      if (typeof storyElement === 'string') {
        container.innerHTML = storyElement;
      } else {
        container.appendChild(storyElement);
      }
      return container;
    },
  ],
};

export const FullWidth: Story = {
  args: {
    tabs: [
      { id: 'overview', label: 'Overview' },
      { id: 'analytics', label: 'Analytics' },
      { id: 'reports', label: 'Reports' },
      { id: 'settings', label: 'Settings' }
    ],
    defaultTab: 'overview',
    children: (
      <>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <Card class="p-6">
            <h3 class="text-lg font-semibold mb-2">Overview</h3>
            <p class="text-secondary">Dashboard overview content</p>
          </Card>
        </TabsContent>
        <TabsContent value="analytics">
          <Card class="p-6">
            <h3 class="text-lg font-semibold mb-2">Analytics</h3>
            <p class="text-secondary">Analytics and metrics</p>
          </Card>
        </TabsContent>
        <TabsContent value="reports">
          <Card class="p-6">
            <h3 class="text-lg font-semibold mb-2">Reports</h3>
            <p class="text-secondary">Generated reports</p>
          </Card>
        </TabsContent>
        <TabsContent value="settings">
          <Card class="p-6">
            <h3 class="text-lg font-semibold mb-2">Settings</h3>
            <p class="text-secondary">Configuration options</p>
          </Card>
        </TabsContent>
      </>
    ),
  },
  decorators: [
    (Story) => {
      const container = document.createElement('div');
      container.className = 'w-full max-w-2xl';
      const storyElement = Story();
      if (typeof storyElement === 'string') {
        container.innerHTML = storyElement;
      } else {
        container.appendChild(storyElement);
      }
      return container;
    },
  ],
};