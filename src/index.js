import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';  // CSS dosyasını import et
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);