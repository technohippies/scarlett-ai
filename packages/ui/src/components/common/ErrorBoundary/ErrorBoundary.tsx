import type { Component, JSX } from 'solid-js';
import { ErrorBoundary as SolidErrorBoundary } from 'solid-js';
import { Button } from '../Button';
import IconWarningFill from 'phosphor-icons-solid/IconWarningFill';

export interface ErrorBoundaryProps {
  children: JSX.Element;
  fallback?: (err: Error, reset: () => void) => JSX.Element;
  onError?: (err: Error) => void;
}

const DefaultErrorFallback: Component<{ error: Error; reset: () => void }> = (props) => {
  return (
    <div class="min-h-screen bg-base flex items-center justify-center p-6">
      <div class="max-w-md w-full text-center space-y-6">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-danger/10">
          <IconWarningFill class="w-8 h-8 text-danger" />
        </div>
        
        <div class="space-y-2">
          <h2 class="text-2xl font-bold text-primary">Something went wrong</h2>
          <p class="text-secondary">
            We encountered an unexpected error. Please try again.
          </p>
        </div>
        
        <details class="text-left">
          <summary class="text-sm text-tertiary cursor-pointer hover:text-secondary transition-colors">
            Error details
          </summary>
          <pre class="mt-2 p-3 bg-surface rounded-lg text-xs text-tertiary overflow-auto">
            {props.error.message}
          </pre>
        </details>
        
        <Button
          variant="primary"
          onClick={props.reset}
          leftIcon={<IconWarningFill />}
        >
          Try Again
        </Button>
      </div>
    </div>
  );
};

export const ErrorBoundary: Component<ErrorBoundaryProps> = (props) => {
  return (
    <SolidErrorBoundary
      fallback={(err, reset) => {
        props.onError?.(err);
        
        if (props.fallback) {
          return props.fallback(err, reset);
        }
        
        return <DefaultErrorFallback error={err} reset={reset} />;
      }}
    >
      {props.children}
    </SolidErrorBoundary>
  );
};