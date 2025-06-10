import type { Meta, StoryObj } from 'storybook-solidjs';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './Tabs';
import { Card } from '../Card';

const meta: Meta<typeof Tabs> = {
  title: 'Common/Tabs',
  component: Tabs,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div class="w-full max-w-md">
      <Tabs 
        tabs={[
          { id: 'lyrics', label: 'Lyrics' },
          { id: 'leaderboard', label: 'Leaderboard' }
        ]}
        defaultTab="lyrics"
      >
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
      </Tabs>
    </div>
  ),
};

export const ThreeTabs: Story = {
  render: () => (
    <div class="w-full max-w-md">
      <Tabs 
        tabs={[
          { id: 'account', label: 'Account' },
          { id: 'security', label: 'Security' },
          { id: 'notifications', label: 'Notifications' }
        ]}
        defaultTab="account"
      >
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
      </Tabs>
    </div>
  ),
};

export const FullWidth: Story = {
  render: () => (
    <div class="w-full max-w-2xl">
      <Tabs 
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'analytics', label: 'Analytics' },
          { id: 'reports', label: 'Reports' },
          { id: 'settings', label: 'Settings' }
        ]}
        defaultTab="overview"
      >
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
      </Tabs>
    </div>
  ),
};