import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
// Import plugin directly to register <map-viewer> custom element
import '../../plugin/src/main.js';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
