import type { Meta, StoryObj } from '@storybook/html'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './Card'
import { Button } from '../Button'
import { solidStory } from '../../../utils/storybook'

const meta: Meta = {
  title: 'Common/Card',
  render: solidStory(Card),
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'outlined', 'elevated'],
    },
    padding: {
      control: 'select',
      options: ['none', 'sm', 'md', 'lg'],
    },
  },
}

export default meta
type Story = StoryObj<typeof Card>

export const Default: Story = {
  args: {
    children: 'This is a default card with some content inside.',
  },
}

export const Outlined: Story = {
  args: {
    variant: 'outlined',
    children: 'This is an outlined card variant.',
  },
}

export const Elevated: Story = {
  args: {
    variant: 'elevated',
    children: 'This is an elevated card with shadow.',
  },
}

export const WithHeader: Story = {
  render: () => {
    const container = document.createElement('div')
    const CardWithHeader = () => (
      <Card>
        <CardHeader>
          <CardTitle>Karaoke Session</CardTitle>
          <CardDescription>
            Track your singing performance and improve your skills
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p class="text-gray-700">
            Your last session scored 85 points! Keep practicing to improve.
          </p>
        </CardContent>
      </Card>
    )
    
    return solidStory(CardWithHeader)({})
  },
}

export const KaraokeScoreCard: Story = {
  render: () => {
    const container = document.createElement('div')
    const ScoreCard = () => (
      <Card variant="elevated">
        <CardHeader>
          <CardTitle>Today's Best Score</CardTitle>
          <CardDescription>
            "Never Gonna Give You Up" - Rick Astley
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div class="text-center py-8">
            <div class="text-5xl font-bold text-violet-600">92</div>
            <div class="text-sm text-gray-600 mt-2">points</div>
          </div>
        </CardContent>
        <CardFooter>
          <Button variant="ghost" size="sm">View Details</Button>
          <Button variant="primary" size="sm">Try Again</Button>
        </CardFooter>
      </Card>
    )
    
    return solidStory(ScoreCard)({})
  },
}

export const PricingCard: Story = {
  render: () => {
    const container = document.createElement('div')
    const PricingCard = () => (
      <Card variant="outlined" padding="lg">
        <CardHeader>
          <CardTitle>Pro Plan</CardTitle>
          <CardDescription>
            Unlimited karaoke sessions with advanced features
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div class="mb-4">
            <span class="text-3xl font-bold">$9.99</span>
            <span class="text-gray-600">/month</span>
          </div>
          <ul class="space-y-2 text-sm">
            <li class="flex items-center">
              <span class="text-green-500 mr-2">✓</span>
              Unlimited songs
            </li>
            <li class="flex items-center">
              <span class="text-green-500 mr-2">✓</span>
              Voice analysis
            </li>
            <li class="flex items-center">
              <span class="text-green-500 mr-2">✓</span>
              Leaderboards
            </li>
          </ul>
        </CardContent>
        <CardFooter>
          <Button variant="primary" fullWidth>
            Subscribe Now
          </Button>
        </CardFooter>
      </Card>
    )
    
    return solidStory(PricingCard)({})
  },
}

export const AllPaddings: Story = {
  render: () => {
    const container = document.createElement('div')
    container.className = 'grid grid-cols-2 gap-4'
    
    const paddings: Array<'none' | 'sm' | 'md' | 'lg'> = ['none', 'sm', 'md', 'lg']
    
    paddings.forEach(padding => {
      const card = solidStory(Card)({ 
        padding, 
        children: `Padding: ${padding}`,
        variant: 'outlined'
      })
      container.appendChild(card)
    })
    
    return container
  },
}