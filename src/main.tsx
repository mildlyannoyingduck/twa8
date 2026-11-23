import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {
  loadCalmBackdrop,
  loadGlassTransparency,
  loadThemeDark,
} from './utils/storage';
import {
  applyA07PerfClass,
  applyGlassTransparencyVars,
} from './utils/transparency';

// Apply theme, transparency & Galaxy A07 60fps mode synchronously before Frame 0
document.documentElement.classList.toggle('dark', loadThemeDark());
applyGlassTransparencyVars(loadGlassTransparency());
applyA07PerfClass(loadCalmBackdrop());

createRoot(document.getElementById('root')!).render(<App />);
