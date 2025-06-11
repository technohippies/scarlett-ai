import { Show, type Component } from 'solid-js';

export interface CountdownProps {
  count: number | null;
}

export const Countdown: Component<CountdownProps> = (props) => {
  return (
    <Show when={props.count !== null}>
      <div class="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
        <div class="text-center">
          <div class="text-8xl font-bold text-white animate-pulse">
            {props.count}
          </div>
          <p class="text-xl text-white/80 mt-4">Get ready!</p>
        </div>
      </div>
    </Show>
  );
};