import type { Component, JSX } from 'solid-js';
import { Show, splitProps } from 'solid-js';
import { cn } from '../../../utils/cn';

export interface SearchInputProps extends JSX.InputHTMLAttributes<HTMLInputElement> {
  onClear?: () => void;
  loading?: boolean;
}

export const SearchInput: Component<SearchInputProps> = (props) => {
  const [local, others] = splitProps(props, [
    'class',
    'onClear',
    'loading',
    'value',
    'onInput'
  ]);

  return (
    <div style={{ position: 'relative' }}>
      <svg
        style={{
          position: 'absolute',
          left: '12px',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '20px',
          height: '20px',
          color: 'var(--color-text-secondary)',
          'pointer-events': 'none'
        }}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="11" cy="11" r="8"></circle>
        <path d="m21 21-4.35-4.35"></path>
      </svg>
      
      <input
        {...others}
        value={local.value || ''}
        onInput={local.onInput}
        style={{
          width: '100%',
          'padding-left': '44px',
          'padding-right': local.value && local.onClear ? '44px' : '16px',
          'padding-top': '12px',
          'padding-bottom': '12px',
          'border-radius': '8px',
          'background-color': 'var(--color-bg-surface)',
          border: '1px solid var(--color-border-default)',
          color: 'var(--color-text-primary)',
          'font-size': '16px',
          transition: 'all 0.2s ease',
          outline: 'none',
          ...(others.style || {})
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = 'var(--color-accent-primary)';
          e.currentTarget.style.boxShadow = '0 0 0 3px rgba(139, 92, 246, 0.1)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = 'var(--color-border-default)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      />
      
      <Show when={local.value && local.onClear}>
        <button
          onClick={local.onClear}
          type="button"
          style={{
            position: 'absolute',
            right: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            padding: '4px',
            cursor: 'pointer',
            color: 'var(--color-text-secondary)',
            transition: 'color 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--color-text-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--color-text-secondary)';
          }}
        >
          <svg 
            style={{ width: '20px', height: '20px' }}
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/>
          </svg>
        </button>
      </Show>
    </div>
  );
};