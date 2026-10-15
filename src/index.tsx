import { render } from 'solid-js/web';
import './index.css';
import { initThemes } from './themes/themeStore';
import App from './App';

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found.');

// Apply the active theme's tokens before the first render so there is no flash
// of an unthemed UI.
initThemes();

render(() => <App />, root);

// Restore the last-used classic skin in the background. Dynamically imported so the
// skin parser + fflate stay in their own lazy chunk, out of the initial bundle.
const restoreSkin = (): void => {
  void import('./skins/skinStore').then((m) => m.initSkins());
};
if ('requestIdleCallback' in window) {
  window.requestIdleCallback(restoreSkin);
} else {
  setTimeout(restoreSkin, 1000);
}
