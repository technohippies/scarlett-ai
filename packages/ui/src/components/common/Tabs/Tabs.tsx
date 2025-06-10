import { createSignal, Show } from 'solid-js';
import type { Component, JSX } from 'solid-js';
import { cn } from '../../../utils/cn';

export interface Tab {
  id: string;
  label: string;
}

export interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
  onTabChange?: (tabId: string) => void;
  children: JSX.Element;
  class?: string;
}

export interface TabsListProps {
  class?: string;
  children: JSX.Element;
}

export interface TabsTriggerProps {
  value: string;
  class?: string;
  children: JSX.Element;
}

export interface TabsContentProps {
  value: string;
  class?: string;
  children: JSX.Element;
}

// Global state for the current tabs instance
let currentTabsState: {
  activeTab: () => string;
  setActiveTab: (id: string) => void;
} | null = null;

export const Tabs: Component<TabsProps> = (props) => {
  const [activeTab, setActiveTab] = createSignal(props.defaultTab || props.tabs[0]?.id || '');
  
  const handleTabChange = (id: string) => {
    setActiveTab(id);
    props.onTabChange?.(id);
  };

  // Set the global state for child components to access
  currentTabsState = {
    activeTab,
    setActiveTab: handleTabChange
  };

  return (
    <div class={cn('w-full', props.class)}>
      {props.children}
    </div>
  );
};

export const TabsList: Component<TabsListProps> = (props) => {
  return (
    <div 
      class={cn(
        'inline-flex h-10 items-center justify-center rounded-md bg-surface p-1 text-secondary',
        'w-full',
        props.class
      )}
    >
      {props.children}
    </div>
  );
};

export const TabsTrigger: Component<TabsTriggerProps> = (props) => {
  const isActive = () => currentTabsState?.activeTab() === props.value;

  return (
    <button
      onClick={() => currentTabsState?.setActiveTab(props.value)}
      class={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5',
        'text-sm font-medium ring-offset-base transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        'flex-1',
        isActive()
          ? 'bg-base text-primary shadow-sm'
          : 'text-secondary hover:text-primary',
        props.class
      )}
    >
      {props.children}
    </button>
  );
};

export const TabsContent: Component<TabsContentProps> = (props) => {
  return (
    <Show when={currentTabsState?.activeTab() === props.value}>
      <div
        class={cn(
          'mt-2 ring-offset-base',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2',
          props.class
        )}
      >
        {props.children}
      </div>
    </Show>
  );
};