import React, { useState, useEffect, useRef } from 'react';
import {
  ClipboardCheck,
  Server,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Activity,
  Zap,
  WifiOff,
  Building2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Send,
  BellRing,
  HardDrive,
  Camera,
} from 'lucide-react';

interface SplashScreenProps {
  message?: string;
  onReady?: () => void;
  minDurationMs?: number;
}

interface SlideItem {
  id: string;
  tag: string;
  title: string;
  description: string;
  highlight: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  badgeBg: string;
  borderGlow: string;
  dotColor: string;
}

const PRESENTATION_SLIDES: SlideItem[] = [
  {
    id: 'pdf',
    tag: 'Envio Imediato',
    title: 'Envio de PDF direto para WhatsApp ou E-mail',
    description:
      'Finalize a vistoria e envie o relatório completo em PDF em poucos segundos, diretamente para o WhatsApp ou e-mail do síndico e administradores.',
    highlight: 'Compartilhamento ágil do laudo em 1 clique',
    icon: Send,
    accentColor: 'text-emerald-400',
    badgeBg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    borderGlow: 'border-emerald-500/30 shadow-emerald-500/10',
    dotColor: 'bg-emerald-400',
  },
  {
    id: 'alertas',
    tag: 'Controle de Prazos',
    title: 'Alertas Críticos de Preventiva a Vencer',
    description:
      'Acompanhe itens com manutenção preventiva próxima do vencimento com alertas visuais automáticos, antecipando serviços e evitando imprevistos.',
    highlight: 'Alertas visuais para itens próximos do vencimento',
    icon: BellRing,
    accentColor: 'text-amber-400',
    badgeBg: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    borderGlow: 'border-amber-500/30 shadow-amber-500/10',
    dotColor: 'bg-amber-400',
  },
  {
    id: 'offline',
    tag: 'Operação em Campo',
    title: 'Funciona Mesmo Offline em Subsolos e Garagens',
    description:
      'Realize vistorias sem sinal de internet em qualquer ambiente. Atenção: a vistoria precisa ser previamente carregada no app antes de ir a campo.',
    highlight: 'Vistoria previamente carregada opera 100% offline',
    icon: WifiOff,
    accentColor: 'text-cyan-400',
    badgeBg: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    borderGlow: 'border-cyan-500/30 shadow-cyan-500/10',
    dotColor: 'bg-cyan-400',
  },
  {
    id: 'drive',
    tag: 'Armazenamento em Nuvem',
    title: 'Integração com Google Drive para Salvar Fotos',
    description:
      'Sincronize todas as fotos e registros da vistoria diretamente no Google Drive, garantindo armazenamento em nuvem seguro e liberando espaço no celular.',
    highlight: 'Backup direto das fotos no Google Drive',
    icon: HardDrive,
    accentColor: 'text-blue-400',
    badgeBg: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    borderGlow: 'border-blue-500/30 shadow-blue-500/10',
    dotColor: 'bg-blue-400',
  },
  {
    id: 'checklists',
    tag: 'Checklists Inteligentes',
    title: 'Registro Fotográfico e Apontamento de Não Conformidades',
    description:
      'Inspecione itens de segurança, bombas, gerador, fachada e áreas comuns, documentando irregularidades com fotos nítidas e níveis de urgência claros.',
    highlight: 'Evidências fotográficas organizadas por área',
    icon: Camera,
    accentColor: 'text-purple-400',
    badgeBg: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    borderGlow: 'border-purple-500/30 shadow-purple-500/10',
    dotColor: 'bg-purple-400',
  },
  {
    id: 'sindico',
    tag: 'Gestão do Condomínio',
    title: 'Portal do Síndico & Histórico Completo',
    description:
      'Acompanhe o histórico de inspeções, consulte relatórios emitidos e monitore a resolução das pendências em um painel transparente e moderno.',
    highlight: 'Histórico centralizado para síndicos e gestores',
    icon: Building2,
    accentColor: 'text-teal-400',
    badgeBg: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
    borderGlow: 'border-teal-500/30 shadow-teal-500/10',
    dotColor: 'bg-teal-400',
  },
];

export const SplashScreen: React.FC<SplashScreenProps> = ({
  message,
  onReady,
  minDurationMs = 800,
}) => {
  const [progress, setProgress] = useState<number>(10);
  const [statusText, setStatusText] = useState<string>(
    message || 'Conectando ao servidor seguro...'
  );
  const [isReady, setIsReady] = useState<boolean>(false);
  const [isFadingOut, setIsFadingOut] = useState<boolean>(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [hasTimeoutError, setHasTimeoutError] = useState<boolean>(false);
  const [retryCount, setRetryCount] = useState<number>(0);

  // Rotating presentation slides state
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);
  const [isSlideFading, setIsSlideFading] = useState<boolean>(false);

  const isMountedRef = useRef<boolean>(true);
  const serverHealthyRef = useRef<boolean>(false);
  const startTimeRef = useRef<number>(Date.now());

  // Automatic slide rotation every 4.2 seconds
  useEffect(() => {
    const slideInterval = setInterval(() => {
      if (!isMountedRef.current || serverHealthyRef.current) return;
      handleNextSlide();
    }, 4200);

    return () => {
      clearInterval(slideInterval);
    };
  }, [currentSlideIndex]);

  const changeSlide = (newIndex: number) => {
    setIsSlideFading(true);
    setTimeout(() => {
      if (!isMountedRef.current) return;
      setCurrentSlideIndex(newIndex);
      setIsSlideFading(false);
    }, 200);
  };

  const handleNextSlide = () => {
    const nextIdx = (currentSlideIndex + 1) % PRESENTATION_SLIDES.length;
    changeSlide(nextIdx);
  };

  const handlePrevSlide = () => {
    const prevIdx =
      (currentSlideIndex - 1 + PRESENTATION_SLIDES.length) %
      PRESENTATION_SLIDES.length;
    changeSlide(prevIdx);
  };

  // Timer counter for elapsed time
  useEffect(() => {
    isMountedRef.current = true;
    const timer = setInterval(() => {
      if (!isMountedRef.current || serverHealthyRef.current) return;
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsedSeconds(elapsed);

      // Show timeout warning and manual retry option after 65 seconds
      if (elapsed >= 65) {
        setHasTimeoutError(true);
      }
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  // Smooth running progress bar animation
  useEffect(() => {
    const progressInterval = setInterval(() => {
      if (!isMountedRef.current) return;

      if (serverHealthyRef.current) {
        // Accelerate quickly to 100%
        setProgress((prev) => {
          if (prev >= 100) return 100;
          return Math.min(100, prev + 15);
        });
        return;
      }

      // If server is not ready yet, advance smoothly and realistically:
      setProgress((prev) => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;

        let target = 20;
        if (elapsed > 2) target = 35;
        if (elapsed > 5) target = 55;
        if (elapsed > 12) target = 72;
        if (elapsed > 20) target = 84;
        if (elapsed > 35) target = 92;
        if (elapsed > 50) target = 96;

        if (prev < target) {
          const step = Math.max(0.5, (target - prev) * 0.1);
          return Math.min(target, Math.round((prev + step) * 10) / 10);
        }
        return prev;
      });

      // Update contextual text based on progress & elapsed time
      if (!message && !serverHealthyRef.current) {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        if (!navigator.onLine) {
          setStatusText('Modo offline detectado. Preparando dados locais...');
        } else if (elapsed < 3) {
          setStatusText('Iniciando aplicação CAST Inspect...');
        } else if (elapsed < 8) {
          setStatusText('Conectando aos serviços em nuvem...');
        } else if (elapsed < 18) {
          setStatusText('Conectando à infraestrutura Cloudflare Edge...');
        } else if (elapsed < 35) {
          setStatusText('Carregando banco de dados e APIs operacionais...');
        } else if (elapsed < 50) {
          setStatusText('Servidor em inicialização rápida, aguarde alguns instantes...');
        } else {
          setStatusText('Finalizando inicialização do ambiente seguro...');
        }
      }
    }, 120);

    return () => {
      clearInterval(progressInterval);
    };
  }, [message]);

  // Active Health Probe / Server Wake-up loop
  useEffect(() => {
    let checkTimeout: any = null;

    async function probeServer() {
      if (!isMountedRef.current || serverHealthyRef.current) return;

      // Se estiver offline, permite continuar com dados em cache após breve instante
      if (!navigator.onLine) {
        setTimeout(() => {
          if (isMountedRef.current && !serverHealthyRef.current) {
            handleServerReady();
          }
        }, 1200);
        return;
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const res = await fetch(`/api/health?t=${Date.now()}`, {
          signal: controller.signal,
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
          },
        });

        clearTimeout(timeoutId);

        if (res.ok && isMountedRef.current) {
          const data = await res.json().catch(() => ({}));
          if (data.status === 'ok' || res.status === 200) {
            handleServerReady();
            return;
          }
        }
      } catch (err) {
        // Normal durante checagem de conectividade com as APIs
      }

      // Se ainda não estiver pronto, agenda a próxima checagem
      if (isMountedRef.current && !serverHealthyRef.current) {
        checkTimeout = setTimeout(probeServer, 1500);
      }
    }

    probeServer();

    return () => {
      if (checkTimeout) clearTimeout(checkTimeout);
    };
  }, [retryCount]);

  const handleServerReady = () => {
    if (serverHealthyRef.current) return;
    serverHealthyRef.current = true;
    setIsReady(true);
    setProgress(100);
    setStatusText('Servidor conectado com sucesso!');

    try {
      sessionStorage.setItem('cast_server_warmed_at', Date.now().toString());
    } catch {
      // ignore
    }

    const elapsedTotal = Date.now() - startTimeRef.current;
    const remainingToMin = Math.max(0, minDurationMs - elapsedTotal);

    // Wait a brief moment to show 100% completion before smooth fade-out
    setTimeout(() => {
      if (!isMountedRef.current) return;
      setIsFadingOut(true);

      setTimeout(() => {
        if (!isMountedRef.current) return;
        if (onReady) {
          onReady();
        }
      }, 450);
    }, remainingToMin + 350);
  };

  const handleManualRetry = () => {
    startTimeRef.current = Date.now();
    setElapsedSeconds(0);
    setHasTimeoutError(false);
    setProgress(15);
    setStatusText('Tentando reconectar ao servidor...');
    setRetryCount((prev) => prev + 1);
  };

  const handleBypass = () => {
    handleServerReady();
  };

  const currentSlide = PRESENTATION_SLIDES[currentSlideIndex];
  const SlideIcon = currentSlide.icon;

  return (
    <div
      id="splash-screen"
      className={`fixed inset-0 z-[99999] flex flex-col items-center justify-between bg-slate-950 text-white px-4 py-6 sm:py-8 overflow-y-auto select-none transition-all duration-500 ease-out ${
        isFadingOut
          ? 'opacity-0 scale-95 pointer-events-none'
          : 'opacity-100 scale-100'
      }`}
    >
      {/* Radiant Background Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/30 via-slate-950 to-slate-950 pointer-events-none" />

      {/* Decorative Grid Mesh overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, #38bdf8 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Main Content Area */}
      <div className="relative z-10 flex flex-col items-center text-center w-full max-w-md my-auto">
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-4 sm:mb-5">
          {/* Brand Icon with Pulsing Halo */}
          <div className="relative mb-3">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center text-white shadow-2xl shadow-blue-500/30 ring-1 ring-cyan-400/40 relative z-10 transition-transform duration-300">
              <ClipboardCheck className="w-7 h-7 sm:w-8 sm:h-8 text-white drop-shadow-md" />
            </div>
            <div className="absolute -inset-1.5 rounded-2xl bg-cyan-500/20 blur-md animate-pulse -z-10" />
            <div className="absolute -inset-3 rounded-2xl bg-blue-600/15 blur-xl -z-20" />
          </div>

          {/* Typography */}
          <div className="flex items-center justify-center gap-2 mb-0.5">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight font-sans">
              CAST
            </h1>
            <span className="text-[10px] sm:text-[11px] uppercase font-extrabold tracking-wider px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-xs">
              INSPECT
            </span>
          </div>

          <p className="text-[11px] sm:text-xs text-slate-400 font-medium tracking-wide">
            Vistorias Técnicas Periódicas em Condomínios
          </p>
        </div>

        {/* ======================================================== */}
        {/* ROTATING PRESENTATION SLIDE CARD                         */}
        {/* ======================================================== */}
        <div className="w-full relative mb-4">
          <div
            className={`w-full bg-slate-900/90 rounded-2xl p-4 sm:p-5 border shadow-2xl backdrop-blur-md transition-all duration-300 text-left relative overflow-hidden ${currentSlide.borderGlow}`}
          >
            {/* Background Accent subtle glow */}
            <div className="absolute -top-12 -right-12 w-28 h-28 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

            <div
              className={`transition-all duration-200 ease-in-out ${
                isSlideFading
                  ? 'opacity-0 translate-y-1 scale-[0.98]'
                  : 'opacity-100 translate-y-0 scale-100'
              }`}
            >
              {/* Category Tag & Slide Counter */}
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${currentSlide.badgeBg}`}
                >
                  <SlideIcon className="w-3 h-3 shrink-0" />
                  <span>{currentSlide.tag}</span>
                </span>

                <span className="text-[10px] font-mono font-medium text-slate-400">
                  {currentSlideIndex + 1} / {PRESENTATION_SLIDES.length}
                </span>
              </div>

              {/* Slide Title */}
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight leading-snug mb-1.5">
                {currentSlide.title}
              </h3>

              {/* Slide Description */}
              <p className="text-[11px] sm:text-xs text-slate-300 leading-relaxed mb-3">
                {currentSlide.description}
              </p>

              {/* Value Proposition Highlight */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/70 border border-slate-800 text-[10px] sm:text-[11px] font-semibold text-slate-200">
                <Sparkles className={`w-3 h-3 ${currentSlide.accentColor}`} />
                <span>{currentSlide.highlight}</span>
              </div>
            </div>

            {/* Slide Navigation Controls */}
            <div className="flex items-center justify-between mt-3.5 pt-3 border-t border-slate-800/80">
              {/* Dots */}
              <div className="flex items-center gap-1.5">
                {PRESENTATION_SLIDES.map((slide, idx) => (
                  <button
                    key={slide.id}
                    onClick={() => changeSlide(idx)}
                    title={`Ir para ${slide.title}`}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      idx === currentSlideIndex
                        ? `w-5 ${currentSlide.dotColor} shadow-[0_0_8px_rgba(56,189,248,0.7)]`
                        : 'w-1.5 bg-slate-700 hover:bg-slate-500'
                    }`}
                  />
                ))}
              </div>

              {/* Prev / Next buttons */}
              <div className="flex items-center gap-1">
                <button
                  onClick={handlePrevSlide}
                  aria-label="Slide anterior"
                  className="p-1 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleNextSlide}
                  aria-label="Próximo slide"
                  className="p-1 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* RUNNING PROGRESS BAR CARD ("corre uma barrinha")          */}
        {/* ======================================================== */}
        <div className="w-full bg-slate-900/90 rounded-2xl p-4 border border-slate-800/80 shadow-2xl backdrop-blur-md mb-3">
          {/* Header with status text & numeric percentage */}
          <div className="flex items-center justify-between gap-2 text-xs font-semibold mb-2.5">
            <div className="flex items-center gap-2 text-slate-300 truncate">
              {isReady ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <Activity className="w-3.5 h-3.5 text-cyan-400 animate-pulse shrink-0" />
              )}
              <span className="truncate text-[12px] font-medium text-slate-200">
                {statusText}
              </span>
            </div>
            <span className="font-mono text-xs font-bold text-cyan-400 tabular-nums shrink-0">
              {Math.round(progress)}%
            </span>
          </div>

          {/* Progress Bar Track */}
          <div className="relative w-full h-2.5 sm:h-3 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800 shadow-inner">
            <div
              className={`h-full rounded-full transition-all duration-300 ease-out relative overflow-hidden ${
                isReady
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_12px_rgba(52,211,153,0.6)]'
                  : 'bg-gradient-to-r from-blue-600 via-cyan-400 to-blue-500 shadow-[0_0_14px_rgba(56,189,248,0.5)]'
              }`}
              style={{ width: `${Math.max(6, progress)}%` }}
            >
              {/* Shimmer light sweep across the bar */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/35 to-transparent w-full -translate-x-full animate-[shimmer_1.8s_infinite]" />
            </div>
          </div>

          {/* Micro status footer under bar */}
          <div className="flex items-center justify-between mt-2.5 text-[11px] text-slate-400 font-medium">
            <span className="flex items-center gap-1 text-slate-400">
              <Server className="w-3 h-3 text-cyan-500" />
              Servidor Cloud
            </span>
            {elapsedSeconds > 0 && !isReady && (
              <span className="text-slate-400 font-mono text-[10px]">
                {elapsedSeconds}s decorridos
              </span>
            )}
            {isReady && (
              <span className="text-emerald-400 font-semibold text-[11px]">
                Conectado
              </span>
            )}
          </div>
        </div>

        {/* Timeout Fallback Action if connection takes unusually long */}
        {hasTimeoutError && !isReady && (
          <div className="w-full bg-amber-950/30 border border-amber-800/40 rounded-xl p-3 text-center text-xs space-y-2 animate-fadeIn mb-3">
            <div className="flex items-center justify-center gap-1.5 font-bold text-amber-300 text-xs">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Servidor demorando para responder</span>
            </div>
            <p className="text-[11px] text-slate-300">
              O servidor ainda está concluindo o boot. Você pode forçar nova tentativa
              ou abrir o aplicativo diretamente.
            </p>
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                onClick={handleManualRetry}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-white text-xs font-bold transition-colors shadow-sm"
              >
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Tentar Novamente</span>
              </button>
              <button
                onClick={handleBypass}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 text-xs font-medium transition-colors"
              >
                <span>Continuar</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer Branding */}
      <div className="relative z-10 text-center text-[10px] text-slate-400 tracking-widest uppercase flex items-center justify-center gap-1.5 font-semibold mt-4">
        <Zap className="w-3 h-3 text-cyan-400" />
        CAST Inspect — Segurança e Conformidade Técnica
      </div>
    </div>
  );
};
