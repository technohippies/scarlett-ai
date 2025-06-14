import { cn } from './cn';

export interface InteractiveListItemProps {
  isActive?: boolean;
  isClickable?: boolean;
  variant?: 'default' | 'compact';
  className?: string;
}

export const interactiveListItemStyles = ({
  isActive = false,
  isClickable = true,
  variant = 'default',
  className = ''
}: InteractiveListItemProps = {}) => {
  return cn(
    // Base styles
    'relative group',
    'transition-all duration-200 ease-out',
    'rounded-lg',
    
    // Variant-specific padding
    variant === 'compact' ? 'py-3 px-4' : 'py-4 px-4',
    
    // Background and border
    'border border-transparent',
    
    // Mobile: always show subtle background for affordance
    // Desktop: transparent until hover
    isClickable && 'bg-highlight/50 md:bg-transparent',
    
    // Clickable states
    isClickable && [
      'cursor-pointer',
      'hover:bg-highlight/50',
      'hover:border-subtle',
      'active:bg-highlight/70',
      'active:scale-[0.99]'
    ],
    
    // Active state
    isActive && 'bg-highlight/50 border-subtle',
    
    // Custom classes
    className
  );
};

export const listContainerStyles = ({
  variant = 'default',
  className = ''
}: {
  variant?: 'default' | 'compact';
  className?: string;
} = {}) => {
  return cn(
    // Base container styles
    'space-y-1',
    
    // Variant-specific spacing
    variant === 'compact' ? 'space-y-0.5' : 'space-y-1',
    
    // Custom classes
    className
  );
};

// Icon styles for affordance indicators
export const affordanceIconStyles = cn(
  'opacity-0 group-hover:opacity-40',
  'transition-opacity duration-200',
  'w-4 h-4',
  'text-text-secondary'
);