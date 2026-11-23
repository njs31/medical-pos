import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './print/print.css';
import './print/emergency-print.css';

// Native confirm/alert dialogs on Windows leave text inputs unable to receive
// typing (e.g. the Inventory search box after deleting/clearing a bill).
// Ask the main process to refocus the window once each dialog closes.
for (const name of ['confirm', 'alert']) {
  const original = window[name]?.bind(window);
  if (!original) continue;
  window[name] = (...args) => {
    try {
      return original(...args);
    } finally {
      window.api?.window?.refocus?.();
    }
  };
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
