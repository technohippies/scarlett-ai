import { render } from 'solid-js/web'

export interface StoryArgs {
  [key: string]: any
}

// Overload signatures
export function solidStory<T extends StoryArgs>(
  Component: (props: T) => any,
  args: T
): HTMLElement
export function solidStory<T extends StoryArgs>(
  Component: (props: T) => any
): (args: T) => HTMLElement
export function solidStory(
  Component: () => any
): HTMLElement

// Implementation
export function solidStory<T extends StoryArgs>(
  Component: ((props: T) => any) | (() => any),
  args?: T
): HTMLElement | ((args: T) => HTMLElement) {
  if (args !== undefined) {
    // Direct rendering with args
    const container = document.createElement('div')
    render(() => <Component {...args} />, container)
    return container
  }
  
  if (Component.length === 0) {
    // Component takes no props, render directly
    const container = document.createElement('div')
    render(() => Component({} as T), container)
    return container
  }
  
  // Return function for story usage
  return (args: T) => {
    const container = document.createElement('div')
    render(() => <Component {...args} />, container)
    return container
  }
}