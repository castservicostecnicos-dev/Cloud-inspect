import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { registerServiceWorker } from './registerServiceWorker';
import { initSyncEngine } from './lib/syncEngine';

// Ativa Service Worker para PWA (em produção)
registerServiceWorker();

// Inicializa motor de monitoramento de conectividade e sincronização automática
try {
  initSyncEngine();
} catch (err) {
  console.warn('[SyncEngine] Falha ao inicializar motor de sincronismo:', err);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);


