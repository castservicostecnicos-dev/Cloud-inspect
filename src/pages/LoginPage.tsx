import React, { useState } from 'react';
import { ClipboardCheck, Lock, Mail, ArrowRight, AlertCircle, Download } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePwaInstall, PwaInstallModal } from '../components/PwaInstallPrompt';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { isInstalled, isInstallable, isIOS, triggerInstall } = usePwaInstall();
  const [showPwaModal, setShowPwaModal] = useState(false);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowPwaModal(true);
    } else if (isInstallable) {
      const ok = await triggerInstall();
      if (!ok) {
        setShowPwaModal(true);
      }
    } else {
      setShowPwaModal(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) {
      setError('Por favor, informe seu e-mail.');
      return;
    }
    if (!password.trim()) {
      setError('Por favor, informe sua senha.');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password.trim());
    } catch (err: any) {
      if (err?.message === 'Failed to fetch' || err?.message?.includes('fetch')) {
        setError('Falha na comunicação com o servidor. Verifique sua conexão com a internet ou tente novamente em instantes.');
      } else {
        setError(err.message || 'E-mail ou senha incorretos.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-8 sm:py-12 px-3.5 sm:px-6 lg:px-8 relative w-full max-w-full overflow-y-auto overflow-x-hidden">
      <div className="w-full max-w-md mx-auto relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/30 mb-3">
            <ClipboardCheck className="w-6 h-6" />
          </div>
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-2xl font-black text-white tracking-tight">CAST</h1>
            <span className="text-xs uppercase font-extrabold tracking-wider px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
              INSPECT
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            Vistorias Técnicas Periódicas
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                E-mail
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value.toLowerCase())}
                  placeholder="seu.email@empresa.com.br"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none lowercase"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Senha
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  required
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm py-3 rounded-xl shadow-lg shadow-blue-600/30 transition-all active:scale-98 disabled:opacity-50 cursor-pointer"
            >
              <span>{loading ? 'Conectando ao servidor...' : 'Entrar'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* PWA Install Button on Login Screen */}
        {!isInstalled && (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={handleInstallClick}
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-white py-2 px-3.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all shadow-md"
            >
              <Download className="w-3.5 h-3.5 text-blue-400" />
              <span>Instalar Aplicativo no Dispositivo (PWA)</span>
            </button>
          </div>
        )}

        {showPwaModal && (
          <PwaInstallModal onClose={() => setShowPwaModal(false)} isIOS={isIOS} />
        )}
      </div>
    </div>
  );
};
