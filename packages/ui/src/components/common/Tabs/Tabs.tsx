import { createSignal, Show, createContext, useContext } from 'solid-js';
import type { Component, JSX, ParentComponent } from 'solid-js';
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

// Context for tabs state
interface TabsContextValue {
  activeTab: () => string;
  setActiveTab: (id: string) => void;
}

const TabsContext = createContext<TabsContextValue>();

export const Tabs: ParentComponent<TabsProps> = (props) => {
  const [activeTab, setActiveTab] = createSignal(props.defaultTab || props.tabs[0]?.id || '');
  
  
  const handleTabChange = (id: string) => {
    setActiveTab(id);
    props.onTabChange?.(id);
  };

  const contextValue: TabsContextValue = {
    activeTab,
    setActiveTab: handleTabChange
  };

  return (
    <TabsContext.Provider value={contextValue}>
      <div class={cn('flex flex-col', props.class)}>
        {props.children}
      </div>
    </TabsContext.Provider>
  );
};

export const TabsList: Component<TabsListProps> = (props) => {
  return (
    <div 
      class={cn(
        'flex h-10 items-center justify-center rounded-md bg-elevated p-1 text-secondary',
        'border border-subtle w-full',
        props.class
      )}
    >
      {props.children}
    </div>
  );
};

export const TabsTrigger: Component<TabsTriggerProps> = (props) => {
  const context = useContext(TabsContext);
  if (!context) {
    console.error('[TabsTrigger] No TabsContext found. TabsTrigger must be used within Tabs component.');
    return null;
  }
  
  const isActive = () => context.activeTab() === props.value;

  return (
    <button
      onClick={() => context.setActiveTab(props.value)}
      class={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5',
        'text-sm font-medium ring-offset-base transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        'flex-1 relative',
        isActive()
          ? 'bg-surface text-primary shadow-sm border border-default'
          : 'text-secondary hover:text-primary hover:bg-highlight/50',
        props.class
      )}
    >
      {props.children}
    </button>
  );
};

export const TabsContent: Component<TabsContentProps> = (props) => {
  const context = useContext(TabsContext);
  if (!context) {
    console.error('[TabsContent] No TabsContext found. TabsContent must be used within Tabs component.');
    return null;
  }
  
  const isActive = () => context.activeTab() === props.value;
  
  return (
    <Show when={isActive()}>
      <div
        class={cn(
          'mt-2 ring-offset-base flex-1',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2',
          props.class
        )}
      >
        {props.children}
      </div>
    </Show>
  );
};