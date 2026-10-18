/**
 * CAST Inspect — Service Worker Registration
 * Registra o Service Worker para habilitar o modo PWA instalável e suporte offline.
 */

export function registerServiceWorker(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  // Não ativa Service Worker em ambiente de desenvolvimento local para evitar conflitos de cache
  if (import.meta.env.DEV) {
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.log('[PWA] Service Worker registrado com sucesso. Escopo:', registration.scope);

        // Verifica atualizações em segundo plano
        registration.onupdatefound = () => {
          const installingWorker = registration.installing;
          if (!installingWorker) return;

          installingWorker.onstatechange = () => {
            if (installingWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                console.log('[PWA] Nova versão do CAST Inspect disponível.');
              } else {
                console.log('[PWA] Conteúdo precacheado para uso offline.');
              }
            }
          };
        };
      })
      .catch((err) => {
        console.warn('[PWA] Falha ao registrar Service Worker:', err);
      });

    // Recarrega suavemente se o controlador mudar após atualização
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  });
}
