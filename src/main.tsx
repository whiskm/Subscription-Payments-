import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ensureDefaults, applyAppearance, readMirror, detectLang } from './lib/settings';
import { routeExternalLinks } from './lib/desktop';
import { isApp } from './lib/platform';
import { AppProvider } from './state/app';
import { DialogsProvider } from './state/dialogs';
import { VaultProvider } from './state/vault';
import './styles/app.css';

// Paint with the saved theme before the database has even opened.
applyAppearance({ theme: 'system', accent: 'vermilion', density: 'cozy', lang: detectLang(), ...readMirror() });

async function start() {
  await ensureDefaults();
  routeExternalLinks();
  if (!isApp && import.meta.env.PROD) {
    const { registerSW } = await import('virtual:pwa-register');
    registerSW({ immediate: true });
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AppProvider>
        <DialogsProvider>
          <VaultProvider>
            <App />
          </VaultProvider>
        </DialogsProvider>
      </AppProvider>
    </StrictMode>,
  );
}

void start();
