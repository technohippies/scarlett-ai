/* @refresh reload */
import { render } from 'solid-js/web';
import App from './App';
import './index.css';
import './styles.css';
import '@scarlett/ui/src/styles/globals.css';

const root = document.getElementById('root');

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    'Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?',
  );
}

console.log('Rendering app to root element:', root);

render(() => <App />, root!);