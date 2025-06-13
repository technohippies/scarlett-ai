import type { Meta, StoryObj } from '@storybook/html';
import { CreditPack, type CreditPackProps } from './CreditPack';
import { solidStory } from '../../../utils/storybook';

const meta: Meta<CreditPackProps> = {
  title: 'Web/CreditPack',
  render: solidStory(CreditPack),
  argTypes: {
    credits: {
      control: { type: 'number' },
    },
    price: {
      control: { type: 'text' },
    },
    currency: {
      control: 'select',
      options: ['USDC', 'ETH', 'SOL'],
    },
    discount: {
      control: { type: 'number', min: 0, max: 100 },
    },
    recommended: {
      control: 'boolean',
    },
    disabled: {
      control: 'boolean',
    },
  },
};

export default meta;
type Story = StoryObj<CreditPackProps>;

export const Basic: Story = {
  args: {
    credits: 250,
    price: '2.50',
    currency: 'USDC',
  },
};

export const Recommended: Story = {
  args: {
    credits: 500,
    price: '4.75',
    currency: 'USDC',
    discount: 5,
    recommended: true,
  },
};

export const WithDiscount: Story = {
  args: {
    credits: 1200,
    price: '10.00',
    currency: 'USDC',
    discount: 16,
  },
};

export const SolanaPack: Story = {
  args: {
    credits: 500,
    price: '0.1',
    currency: 'SOL',
  },
};

export const EthereumPack: Story = {
  args: {
    credits: 1000,
    price: '0.002',
    currency: 'ETH',
  },
};

export const Disabled: Story = {
  args: {
    credits: 250,
    price: '2.50',
    currency: 'USDC',
    disabled: true,
  },
};

export const PackOptions: Story = {
  render: () => {
    const container = document.createElement('div');
    container.className = 'grid grid-cols-1 md:grid-cols-3 gap-4 p-4';
    
    // Entry pack
    container.appendChild(solidStory(CreditPack, {
      credits: 250,
      price: '2.50',
      currency: 'USDC',
      onPurchase: () => console.log('Purchase 250 credits'),
    }));
    
    // Recommended pack
    container.appendChild(solidStory(CreditPack, {
      credits: 500,
      price: '4.75',
      currency: 'USDC',
      discount: 5,
      recommended: true,
      onPurchase: () => console.log('Purchase 500 credits'),
    }));
    
    // Bulk pack
    container.appendChild(solidStory(CreditPack, {
      credits: 1200,
      price: '10.00',
      currency: 'USDC',
      discount: 16,
      onPurchase: () => console.log('Purchase 1200 credits'),
    }));
    
    return container;
  },
};