import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import App from './App.tsx';
import './index.css';

// Handle stale chunk errors after deploys: Vite fires 'vite:preloadError'
// when a dynamically imported module (hashed chunk) no longer exists on the
// server. Reload once (guarded by sessionStorage + timestamp) to pick up the
// new build; if it still fails, show a friendly reload message.
window.addEventListener('vite:preloadError', (e) => {
  e.preventDefault();
  const KEY = '__vite_retry_ts';
  const stored = sessionStorage.getItem(KEY);
  const now = Date.now();
  if (!stored || now - parseInt(stored, 10) > 10_000) {
    sessionStorage.setItem(KEY, String(now));
    window.location.reload();
    return;
  }
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `
      <div style="min-height:100vh;background:#080c14;color:white;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        <div style="text-align:center;max-width:360px;padding:24px;">
          <p style="font-size:18px;font-weight:700;margin:0 0 8px;">A new version of the site is available</p>
          <p style="font-size:14px;color:rgba(255,255,255,0.4);margin:0 0 20px;">Please reload to get the latest version.</p>
          <button onclick="window.location.reload()" style="padding:10px 20px;border-radius:8px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.1);color:white;font-size:14px;font-weight:600;cursor:pointer;">Reload</button>
        </div>
      </div>`;
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Analytics />
  </StrictMode>
);
