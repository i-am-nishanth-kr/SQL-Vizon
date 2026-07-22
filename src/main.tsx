/**
	Project: SQL Vizion
	Author: Nishanth
	Version: 1.0.0
	License: MIT
**/
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress benign ResizeObserver errors caused by layout/panel resizing
window.addEventListener('error', (e) => {
  if (
    e.message.includes('ResizeObserver loop completed with undelivered notifications') ||
    e.message.includes('ResizeObserver loop limit exceeded')
  ) {
    e.stopImmediatePropagation();
    e.preventDefault();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

