import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Erro capturado na interface:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    localStorage.removeItem('cast_inspect_token');
    localStorage.removeItem('cast_inspect_user');
    localStorage.removeItem('cast_inspect_company');
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white font-sans">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-4 text-amber-400">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Ops! Ocorreu uma oscilação</h2>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              O aplicativo encontrou uma falha de carregamento ou cache desatualizado. Você pode recarregar a página ou restaurar a sessão limpa.
            </p>

            {this.state.error && (
              <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl text-[11px] text-red-400 font-mono text-left mb-6 overflow-x-auto max-h-32">
                {this.state.error.message}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all shadow-lg shadow-blue-600/30 active:scale-95"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Recarregar App</span>
              </button>
              <button
                type="button"
                onClick={this.handleReset}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 transition-all active:scale-95"
              >
                <Home className="w-4 h-4" />
                <span>Restaurar Início</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
