/* @refresh reload */
import { render } from 'solid-js/web';
import { Router } from '@solidjs/router';
import Routes from './routes';
import '@scarlett/ui/dist/ui.css';
import './styles.css';

// Initialize wallet service
import './services/wallet';

const root = document.getElementById('root');

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    'Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?',
  );
}

console.log('Rendering app to root element:', root);

render(() => (
  <Router>
    <Routes />
  </Router>
), root!);