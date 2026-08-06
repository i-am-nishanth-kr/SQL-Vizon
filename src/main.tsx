import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Guard native ResizeObserver to prevent loop notifications from firing within the same frame
if (typeof window !== 'undefined' && window.ResizeObserver) {
  const NativeResizeObserver = window.ResizeObserver;
  window.ResizeObserver = class WrappedResizeObserver extends NativeResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      super((entries, observer) => {
        window.requestAnimationFrame(() => {
          callback(entries, observer);
        });
      });
    }
  };
}
const isResizeObserverError = (msg: string | undefined | null) => {
  if (!msg) return false;
  return (
    msg.includes('ResizeObserver loop completed with undelivered notifications') ||
    msg.includes('ResizeObserver loop limit exceeded')
  );
};

window.addEventListener('error', (e: ErrorEvent) => {
  if (isResizeObserverError(e.message) || isResizeObserverError(e.error?.message)) {
    e.stopImmediatePropagation();
    e.preventDefault();
  }
});

window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
  if (isResizeObserverError(e.reason?.message) || isResizeObserverError(String(e.reason))) {
    e.preventDefault();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

