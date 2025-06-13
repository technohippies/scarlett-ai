import type { Meta, StoryObj } from '@storybook/html';
import { Tabs, TabsList, TabsTrigger, TabsContent, type TabsProps } from './Tabs';
import { Card } from '../Card';
import { solidStory } from '../../../utils/storybook';

const meta: Meta<TabsProps> = {
  title: 'Common/Tabs',
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#0a0a0a' },
      ],
    },
  },
};

export default meta;
type Story = StoryObj<TabsProps>;

export const Default: Story = {
  render: () => {
    const outerContainer = document.createElement('div');
    outerContainer.className = 'bg-base p-4 rounded-lg';
    outerContainer.style.width = '400px';
    
    const DefaultTabs = () => (
      <Tabs
        tabs={[
          { id: 'lyrics', label: 'Lyrics' },
          { id: 'leaderboard', label: 'Leaderboard' }
        ]}
        defaultTab="lyrics"
        class="flex flex-col"
      >
        <TabsList>
          <TabsTrigger value="lyrics">Lyrics</TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
        </TabsList>
        <TabsContent value="lyrics" class="mt-4">
          <Card class="p-6">
            <h3 class="text-lg font-semibold mb-2">Lyrics View</h3>
            <p class="text-secondary">Song lyrics would appear here</p>
          </Card>
        </TabsContent>
        <TabsContent value="leaderboard" class="mt-4">
          <Card class="p-6">
            <h3 class="text-lg font-semibold mb-2">Leaderboard</h3>
            <p class="text-secondary">Top scores would appear here</p>
          </Card>
        </TabsContent>
      </Tabs>
    );
    
    outerContainer.appendChild(solidStory(DefaultTabs));
    return outerContainer;
  },
};

export const ThreeTabs: Story = {
  render: () => {
    const container = document.createElement('div');
    container.className = 'w-full max-w-md';
    
    const ThreeTabsExample = () => (
      <Tabs
        tabs={[
          { id: 'account', label: 'Account' },
          { id: 'security', label: 'Security' },
          { id: 'notifications', label: 'Notifications' }
        ]}
        defaultTab="account"
        class="flex flex-col h-full"
      >
        <div class="px-4">
          <TabsList>
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="account" class="flex-1 px-4">
          <Card class="p-6">
            <h3 class="text-lg font-semibold mb-2">Account Settings</h3>
            <p class="text-secondary">Manage your account details</p>
          </Card>
        </TabsContent>
        <TabsContent value="security" class="flex-1 px-4">
          <Card class="p-6">
            <h3 class="text-lg font-semibold mb-2">Security Settings</h3>
            <p class="text-secondary">Update your security preferences</p>
          </Card>
        </TabsContent>
        <TabsContent value="notifications" class="flex-1 px-4">
          <Card class="p-6">
            <h3 class="text-lg font-semibold mb-2">Notification Settings</h3>
            <p class="text-secondary">Configure your notifications</p>
          </Card>
        </TabsContent>
      </Tabs>
    );
    
    container.appendChild(solidStory(ThreeTabsExample));
    return container;
  },
};

export const FullWidth: Story = {
  render: () => {
    const container = document.createElement('div');
    container.className = 'w-full max-w-2xl';
    
    const FullWidthTabs = () => (
      <Tabs
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'analytics', label: 'Analytics' },
          { id: 'reports', label: 'Reports' },
          { id: 'settings', label: 'Settings' }
        ]}
        defaultTab="overview"
        class="flex flex-col h-full"
      >
        <div class="px-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="overview" class="flex-1 px-4">
          <Card class="p-6">
            <h3 class="text-lg font-semibold mb-2">Overview</h3>
            <p class="text-secondary">Dashboard overview content</p>
          </Card>
        </TabsContent>
        <TabsContent value="analytics" class="flex-1 px-4">
          <Card class="p-6">
            <h3 class="text-lg font-semibold mb-2">Analytics</h3>
            <p class="text-secondary">Analytics and metrics</p>
          </Card>
        </TabsContent>
        <TabsContent value="reports" class="flex-1 px-4">
          <Card class="p-6">
            <h3 class="text-lg font-semibold mb-2">Reports</h3>
            <p class="text-secondary">Generated reports</p>
          </Card>
        </TabsContent>
        <TabsContent value="settings" class="flex-1 px-4">
          <Card class="p-6">
            <h3 class="text-lg font-semibold mb-2">Settings</h3>
            <p class="text-secondary">Configuration options</p>
          </Card>
        </TabsContent>
      </Tabs>
    );
    
    container.appendChild(solidStory(FullWidthTabs));
    return container;
  },
};

export const ExtensionStyle: Story = {
  render: () => {
    // Create fixed-width container matching extension widget
    const container = document.createElement('div');
    container.style.cssText = `
      width: 480px;
      height: 600px;
      background-color: var(--color-bg-surface);
      border-radius: 16px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    `;
    
    const ExtensionTabs = () => (
      <Tabs
        tabs={[
          { id: 'lyrics', label: 'Lyrics' },
          { id: 'leaderboard', label: 'Leaderboard' }
        ]}
        defaultTab="lyrics"
        class="flex-1 flex flex-col min-h-0"
      >
        <div class="px-4">
          <TabsList>
            <TabsTrigger value="lyrics">Lyrics</TabsTrigger>
            <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value="lyrics" class="flex-1 min-h-0">
          <div class="flex flex-col h-full">
            <div class="flex-1 min-h-0 overflow-hidden p-4">
              <div class="space-y-4">
                <p class="text-secondary">Ready to start singing</p>
                <p class="text-secondary">Lyrics will appear here</p>
                <p class="text-secondary">As the song plays</p>
              </div>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="leaderboard" class="flex-1 min-h-0">
          <div class="overflow-y-auto h-full p-4">
            <div class="space-y-3">
              <div class="flex items-center gap-3 p-3 bg-elevated rounded-lg">
                <span class="text-lg font-bold text-accent-primary">1</span>
                <span class="text-primary flex-1">Player One</span>
                <span class="text-secondary">950</span>
              </div>
              <div class="flex items-center gap-3 p-3 bg-elevated rounded-lg">
                <span class="text-lg font-bold text-secondary">2</span>
                <span class="text-primary flex-1">Player Two</span>
                <span class="text-secondary">920</span>
              </div>
              <div class="flex items-center gap-3 p-3 bg-elevated rounded-lg">
                <span class="text-lg font-bold text-secondary">3</span>
                <span class="text-primary flex-1">Player Three</span>
                <span class="text-secondary">880</span>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    );
    
    // Add some padding at the top to simulate the extension header
    const header = document.createElement('div');
    header.className = 'h-12 border-b border-subtle';
    container.appendChild(header);
    
    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'flex-1 flex flex-col min-h-0 pt-4';
    tabsContainer.appendChild(solidStory(ExtensionTabs));
    container.appendChild(tabsContainer);
    
    return container;
  },
};