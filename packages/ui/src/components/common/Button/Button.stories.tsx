import type { Meta, StoryObj } from '@storybook/html'
import { Button } from './Button'
import { solidStory } from '../../../utils/storybook'
import IconArrowRightRegular from 'phosphor-icons-solid/IconArrowRightRegular'
import IconDownloadRegular from 'phosphor-icons-solid/IconDownloadRegular'
import IconMusicNoteRegular from 'phosphor-icons-solid/IconMusicNoteRegular'

const meta: Meta = {
  title: 'Common/Button',
  render: solidStory(Button),
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'ghost', 'danger'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    fullWidth: {
      control: 'boolean',
    },
    loading: {
      control: 'boolean',
    },
    disabled: {
      control: 'boolean',
    },
  },
}

export default meta
type Story = StoryObj<typeof Button>

export const Primary: Story = {
  args: {
    children: 'Start Karaoke',
    variant: 'primary',
  },
}

export const Secondary: Story = {
  args: {
    children: 'View Lyrics',
    variant: 'secondary',
  },
}

export const Ghost: Story = {
  args: {
    children: 'Skip',
    variant: 'ghost',
  },
}

export const Danger: Story = {
  args: {
    children: 'Delete Recording',
    variant: 'danger',
  },
}

export const WithIcons: Story = {
  args: {
    children: 'Continue',
    rightIcon: <IconArrowRightRegular />,
  },
}

export const WithLeftIcon: Story = {
  args: {
    children: 'Download',
    leftIcon: <IconDownloadRegular />,
    variant: 'secondary',
  },
}

export const Loading: Story = {
  args: {
    children: 'Processing...',
    loading: true,
  },
}

export const Disabled: Story = {
  args: {
    children: 'Unavailable',
    disabled: true,
  },
}

export const AllSizes: Story = {
  render: () => {
    const container = document.createElement('div')
    container.className = 'flex items-center gap-4'
    
    container.appendChild(solidStory(Button)({ children: 'Small', size: 'sm' }))
    container.appendChild(solidStory(Button)({ children: 'Medium', size: 'md' }))
    container.appendChild(solidStory(Button)({ children: 'Large', size: 'lg' }))
    
    return container
  },
}

export const AllVariants: Story = {
  render: () => {
    const container = document.createElement('div')
    container.className = 'flex flex-wrap gap-4'
    
    container.appendChild(solidStory(Button)({ children: 'Primary', variant: 'primary' }))
    container.appendChild(solidStory(Button)({ children: 'Secondary', variant: 'secondary' }))
    container.appendChild(solidStory(Button)({ children: 'Ghost', variant: 'ghost' }))
    container.appendChild(solidStory(Button)({ children: 'Danger', variant: 'danger' }))
    
    return container
  },
}

export const KaraokeButton: Story = {
  args: {
    children: 'Start Singing',
    leftIcon: <IconMusicNoteRegular />,
    size: 'lg',
    variant: 'primary',
  },
}