import { render } from 'solid-js/web'

export interface StoryArgs {
  [key: string]: any
}

export function solidStory<T extends StoryArgs>(
  Component: (props: T) => any
): (args: T) => HTMLElement {
  return (args: T) => {
    const container = document.createElement('div')
    render(() => <Component {...args} />, container)
    return container
  }
}