// Must run before react-dom loads so React finds the hook.
import './devtoolsHook';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

// No StrictMode: it would call every component twice and double the render log.
createRoot(document.getElementById('root')!).render(<App />);
