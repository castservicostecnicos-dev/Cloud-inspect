import React, { useState, useEffect } from 'react';
import { Download, Share, PlusSquare, X, Smartphone, CheckCircle2, ShieldCheck } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already in standalone mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      console.log('[PWA] CAST Inspect foi instalado com sucesso!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const triggerInstall = async (): Promise<boolean> => {
    if (!deferredPrompt) {
      return false;
    }
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
        setIsInstallable(false);
        setDeferredPrompt(null);
        return true;
      }
    } catch (err) {
      console.warn('[PWA] Erro ao disparar prompt de instalação:', err);
    }
    return false;
  };

  return {
    deferredPrompt,
    isInstallable: isInstallable || (isIOS && !isInstalled),
    isInstalled,
    isIOS,
    triggerInstall,
  };
}

interface PwaInstallBannerProps {
  onOpenModal?: () => void;
}

export function PwaInstallBanner({ onOpenModal }: PwaInstallBannerProps) {
  const { isInstalled, isIOS, isInstallable, triggerInstall } = usePwaInstall();
  const [dismissed, setDismissed] = useState(false);
  const [showIosModal, setShowIosModal] = useState(false);

  useEffect(() => {
    const isDismissed = localStorage.getItem('cast_pwa_banner_dismissed') === 'true';
    if (isDismissed) {
      setDismissed(true);
    }
  }, []);

  if (isInstalled || dismissed) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIosModal(true);
      if (onOpenModal) onOpenModal();
    } else if (isInstallable) {
      const installed = await triggerInstall();
      if (!installed) {
        // If native prompt not ready, show manual guide modal
        setShowIosModal(true);
      }
    } else {
      setShowIosModal(true);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('cast_pwa_banner_dismissed', 'true');
  };

  return (
    <>
      {/* Floating Bottom PWA Install Banner */}
      <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 animate-bounce-short">
        <div className="bg-slate-900 border border-slate-700/90 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-md">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 p-0.5 shadow-md shrink-0 flex items-center justify-center">
            <img
              src="/icon.svg"
              alt="CAST Inspect"
              className="w-10 h-10 rounded-[10px]"
            />
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5 truncate">
              <span>Instalar CAST Inspect</span>
              <span className="bg-blue-500/20 text-blue-400 text-[10px] font-semibold px-1.5 py-0.5 rounded border border-blue-500/30">
                PWA
              </span>
            </h4>
            <p className="text-[11px] text-slate-300 line-clamp-1">
              Acesso rápido e vistorias mesmo sem internet
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleInstallClick}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-blue-600/30 flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Instalar</span>
            </button>
            <button
              onClick={handleDismiss}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              title="Fechar lembrete"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Instructions Modal for iOS / Desktop Browsers */}
      {showIosModal && (
        <PwaInstallModal onClose={() => setShowIosModal(false)} isIOS={isIOS} />
      )}
    </>
  );
}

interface PwaInstallModalProps {
  onClose: () => void;
  isIOS?: boolean;
}

export function PwaInstallModal({ onClose, isIOS }: PwaInstallModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden text-slate-900 animate-scaleUp">
        {/* Header */}
        <div className="bg-slate-900 text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 p-0.5 shadow-lg flex items-center justify-center">
              <img
                src="/icon.svg"
                alt="CAST Inspect"
                className="w-11 h-11 rounded-[14px]"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-white">CAST Inspect</h3>
                <span className="bg-blue-500/20 text-blue-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-500/30">
                  Instalável
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Aplicativo Web Progressivo Oficial
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3.5 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-950 leading-relaxed">
              <span className="font-bold">Vantagens do Aplicativo:</span>
              <ul className="mt-1 space-y-1 list-disc list-inside text-blue-900 text-[11px]">
                <li>Funciona sem internet direto nos condomínios</li>
                <li>Tela cheia sem barras do navegador</li>
                <li>Ícone exclusivo na tela de início do seu aparelho</li>
              </ul>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {isIOS ? 'Como instalar no iPhone / iPad (Safari):' : 'Como instalar no seu dispositivo:'}
            </h4>

            {isIOS ? (
              <ol className="space-y-3 text-xs text-slate-700">
                <li className="flex items-start gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                    1
                  </div>
                  <div className="leading-snug">
                    Toque no botão <span className="font-semibold text-slate-900">Compartilhar</span>{' '}
                    <Share className="w-3.5 h-3.5 inline text-blue-600 mx-0.5" /> no menu inferior do Safari.
                  </div>
                </li>

                <li className="flex items-start gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                    2
                  </div>
                  <div className="leading-snug">
                    Role a lista para baixo e selecione{' '}
                    <span className="font-semibold text-slate-900">Adicionar à Tela de Início</span>{' '}
                    <PlusSquare className="w-3.5 h-3.5 inline text-blue-600 mx-0.5" />.
                  </div>
                </li>

                <li className="flex items-start gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                    3
                  </div>
                  <div className="leading-snug">
                    Confirme tocando em <span className="font-semibold text-slate-900">Adicionar</span> no canto superior direito.
                  </div>
                </li>
              </ol>
            ) : (
              <ol className="space-y-3 text-xs text-slate-700">
                <li className="flex items-start gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                    1
                  </div>
                  <div className="leading-snug">
                    No Google Chrome, Edge ou Samsung Internet, toque no menu de 3 pontos{' '}
                    <span className="font-bold text-slate-900">(⋮)</span> ou no ícone de instalação na barra de endereço.
                  </div>
                </li>

                <li className="flex items-start gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                    2
                  </div>
                  <div className="leading-snug">
                    Selecione <span className="font-semibold text-slate-900">Instalar aplicativo</span> ou{' '}
                    <span className="font-semibold text-slate-900">Adicionar à tela inicial</span>.
                  </div>
                </li>

                <li className="flex items-start gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                    3
                  </div>
                  <div className="leading-snug">
                    O CAST Inspect abrirá como app independente com acesso instantâneo.
                  </div>
                </li>
              </ol>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all shadow-md"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
