import React, { useState, useEffect } from 'react';
import {
  ClipboardCheck,
  Building2,
  UserCheck,
  Bell,
  Wifi,
  WifiOff,
  RefreshCw,
  PlusCircle,
  ChevronDown,
  Shield,
  LogOut,
  AlertCircle,
  Check,
  Download,
  Smartphone,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole, SupervisorNotification } from '../types';
import {
  subscribeSyncStatus,
  syncPendingToFirestore,
  SyncStatus,
} from '../lib/syncEngine';
import { usePwaInstall, PwaInstallModal } from './PwaInstallPrompt';

interface NavbarProps {
  currentView: string;
  onNavigate: (view: string, param?: string) => void;
  onRefreshData?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onNavigate,
  onRefreshData,
}) => {
  const {
    user,
    company,
    availableCompanies,
    logout,
    switchRole,
    switchCompany,
    canExecuteInspection,
    canSwitchRoles,
    canManageCompanies,
  } = useAuth();

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [notifications, setNotifications] = useState<SupervisorNotification[]>([]);
  const [showNotifPopover, setShowNotifPopover] = useState(false);
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showCompanyMenu, setShowCompanyMenu] = useState(false);

  // PWA Install State & Trigger
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

  // Subscribe to sync status & online monitor
  useEffect(() => {
    const unsubscribe = subscribeSyncStatus((status: SyncStatus) => {
      setIsOnline(status.isOnline);
      setPendingCount(status.pendingCount);
      setSyncing(status.isSyncing);
    });
    return unsubscribe;
  }, []);

  // Fetch notifications for company (only for company users, not DEV)
  const fetchNotifications = async () => {
    if (!company || user?.role === 'DEV' || !navigator.onLine) {
      setNotifications([]);
      return;
    }
    try {
      const res = await fetch('/api/notifications', {
        headers: {
          'x-company-id': company.id,
          'x-user-role': user?.role || '',
        },
      });
      if (res.ok) {
        const notifs = await res.json();
        setNotifications(notifs);
      }
    } catch (e) {
      // offline or error
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, [company]);

  // Sync offline queue directly to Firestore & Server
  const handleSyncOffline = async () => {
    if (!isOnline || pendingCount === 0 || syncing) return;
    try {
      const res = await syncPendingToFirestore();
      if (res.successCount > 0 && onRefreshData) {
        onRefreshData();
      }
    } catch (err) {
      console.error('Failed to sync offline items', err);
    }
  };

  const markNotifRead = async (id: string) => {
    if (!company) return;
    try {
      await fetch(`/api/notifications/${id}/read`, {
        method: 'POST',
        headers: { 'x-company-id': company.id },
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch (e) {
      // ignore
    }
  };

  const unreadNotifs = notifications.filter((n) => !n.read);

  const roles: { role: UserRole; label: string; desc: string }[] = [
    { role: 'DEV', label: 'Desenvolvedor (Dev)', desc: 'Empresas (criar/editar/excluir/ativar) e suporte mestre' },
    { role: 'GERENTE', label: 'Gerente Geral', desc: 'Gestão da equipe, condomínios, aprovações e vistorias' },
    { role: 'TECNICO', label: 'Técnico / Inspetor', desc: 'Realização de vistorias em campo e fotos' },
    { role: 'ADM_PREDIAL', label: 'Adm. Predial / Síndico', desc: 'Consulta de relatórios e laudos do condomínio' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 text-white shadow-md w-full max-w-full overflow-visible">
      <div className="max-w-7xl w-full mx-auto px-2.5 sm:px-6 h-16 flex items-center justify-between gap-1.5 sm:gap-4">
        {/* Brand & Logo */}
        <div className="flex items-center gap-2 sm:gap-4 min-w-0 shrink">
          <button
            onClick={() => onNavigate('dashboard')}
            className="flex items-center gap-2 sm:gap-2.5 group text-left min-w-0 shrink"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-600/30 group-hover:bg-blue-500 transition-colors shrink-0">
              <ClipboardCheck className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1 sm:gap-1.5">
                <span className="font-extrabold text-sm sm:text-base tracking-tight text-white">
                  CAST
                </span>
                <span className="font-semibold text-[10px] sm:text-xs tracking-wider uppercase px-1 sm:px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  INSPECT
                </span>
              </div>
              <p className="text-[9px] sm:text-[10px] text-slate-400 font-medium tracking-wide truncate hidden sm:block">
                Vistorias Técnicas Periódicas
              </p>
            </div>
          </button>

          {/* Multi-empresa dropdown (Switching between companies - only for DEV/GERENTE) */}
          <div className="relative hidden md:block">
            {canManageCompanies && availableCompanies.length > 1 ? (
              <>
                <button
                  onClick={() => {
                    setShowCompanyMenu(!showCompanyMenu);
                    setShowRoleMenu(false);
                    setShowNotifPopover(false);
                  }}
                  className="flex items-center gap-2 bg-slate-800/80 hover:bg-slate-800 text-xs px-2.5 py-1.5 rounded-lg border border-slate-700/80 text-slate-300 transition-colors"
                >
                  <Building2 className="w-3.5 h-3.5 text-blue-400" />
                  <span className="max-w-[140px] truncate font-medium">
                    {company?.tradeName || company?.name || 'Selecione Empresa'}
                  </span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>

                {showCompanyMenu && (
                  <div className="fixed inset-x-3.5 top-16 sm:absolute sm:inset-auto sm:left-0 sm:mt-2 max-w-xs sm:w-64 bg-white rounded-xl shadow-2xl border border-slate-200 py-1.5 z-50 text-slate-900 animate-fadeIn">
                    <div className="px-3 py-1.5 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Ambiente Multiempresa
                    </div>
                    {availableCompanies.map((comp) => (
                      <button
                        key={comp.id}
                        onClick={() => {
                          switchCompany(comp.id);
                          setShowCompanyMenu(false);
                          if (onRefreshData) onRefreshData();
                        }}
                        className={`w-full text-left px-3 py-2 text-xs flex flex-col hover:bg-slate-50 transition-colors ${
                          company?.id === comp.id ? 'bg-blue-50/70 border-l-2 border-blue-600 font-semibold' : ''
                        }`}
                      >
                        <span className="text-slate-800 font-medium">{comp.name}</span>
                        <span className="text-[10px] text-slate-400">CNPJ: {comp.cnpj}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2 bg-slate-800/50 text-xs px-2.5 py-1.5 rounded-lg border border-slate-700/60 text-slate-300">
                <Building2 className="w-3.5 h-3.5 text-blue-400" />
                <span className="max-w-[160px] truncate font-medium">
                  {company?.tradeName || company?.name || 'Empresa'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Action Controls & User Info */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Offline / Online indicator & sync button */}
          <div className="flex items-center">
            {isOnline ? (
              pendingCount > 0 ? (
                <button
                  onClick={handleSyncOffline}
                  disabled={syncing}
                  className="flex items-center gap-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs px-2 py-1 sm:px-2.5 rounded-lg hover:bg-amber-500/30 transition-colors cursor-pointer shadow-xs"
                  title="Clique para sincronizar vistorias pendentes no IndexedDB com o Firebase Firestore"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                  <span className="text-[10px] sm:text-[11px] font-semibold">
                    {syncing ? 'Sincronizando...' : `Sync (${pendingCount})`}
                  </span>
                </button>
              ) : (
                <div
                  className="hidden sm:flex items-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20 font-medium"
                  title="Conectado com Firebase Firestore e Nuvem"
                >
                  <Wifi className="w-3 h-3" />
                  <span>Online</span>
                </div>
              )
            ) : (
              <div
                className="flex items-center gap-1 text-[10px] sm:text-[11px] text-amber-400 bg-amber-500/20 px-2 py-1 rounded-md border border-amber-500/30 font-semibold shadow-xs"
                title="Sem conexão com a internet. Vistorias serão salvas com segurança no IndexedDB."
              >
                <WifiOff className="w-3 h-3" />
                <span>{pendingCount > 0 ? `Offline (${pendingCount})` : 'Offline'}</span>
              </div>
            )}
          </div>

          {/* Supervisor Notification Alert Bell (Only for company team, not for DEV) */}
          {user?.role !== 'DEV' && (
            <div className="relative">
              <button
                onClick={() => {
                  setShowNotifPopover(!showNotifPopover);
                  setShowRoleMenu(false);
                  setShowCompanyMenu(false);
                }}
                className="relative p-1.5 sm:p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                title="Notificações da Empresa"
              >
                <Bell className="w-4 h-4" />
                {unreadNotifs.length > 0 && (
                  <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center animate-pulse">
                    {unreadNotifs.length}
                  </span>
                )}
              </button>

              {/* Notification Popover */}
              {showNotifPopover && (
                <div className="fixed inset-x-3.5 top-16 sm:absolute sm:inset-auto sm:right-0 sm:mt-2 max-w-sm sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-50 text-slate-900 animate-fadeIn">
                  <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
                      <AlertCircle className="w-4 h-4 text-red-500" />
                      <span>Alertas para Supervisão Técnica</span>
                    </div>
                    <span className="text-[10px] text-slate-400">{notifications.length} registros</span>
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400">
                        Nenhuma notificação crítica registrada.
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`p-3 text-xs hover:bg-slate-50 transition-colors ${
                            !n.read ? 'bg-amber-50/50' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-semibold text-slate-800">
                              {n.condominiumName} — {n.blockName}
                            </span>
                            {!n.read && (
                              <button
                                onClick={() => markNotifRead(n.id)}
                                className="text-[10px] text-blue-600 hover:underline font-medium shrink-0"
                              >
                                Marcar lido
                              </button>
                            )}
                          </div>
                          <p className="text-slate-600 mt-1 text-[11px] leading-relaxed">
                            {n.message}
                          </p>
                          <div className="flex items-center justify-between mt-2 text-[10px] text-slate-400">
                            <span>Vistoriador: {n.inspectorName}</span>
                            <span>{new Date(n.createdAt).toLocaleDateString('pt-BR')}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Quick Create Inspection Button */}
          {canExecuteInspection && (
            <button
              onClick={() => onNavigate('new-inspection')}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl shadow-md shadow-blue-600/20 transition-all active:scale-95"
              title="Iniciar Nova Vistoria"
            >
              <PlusCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Nova Vistoria</span>
            </button>
          )}

          {/* PWA Install Button (if not already running in standalone mode) */}
          {!isInstalled && (
            <button
              onClick={handleInstallClick}
              className="flex items-center gap-1.5 bg-gradient-to-r from-blue-600/25 to-indigo-600/25 hover:from-blue-600/40 hover:to-indigo-600/40 text-blue-300 hover:text-white border border-blue-500/30 text-xs px-2 sm:px-2.5 py-1.5 rounded-xl font-semibold transition-all shadow-xs"
              title="Instalar CAST Inspect como aplicativo PWA no seu celular ou computador"
            >
              <Download className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden md:inline">Instalar App</span>
            </button>
          )}

          {/* User Role Switcher Menu */}
          <div className="relative">
            <button
              onClick={() => {
                setShowRoleMenu(!showRoleMenu);
                setShowCompanyMenu(false);
                setShowNotifPopover(false);
              }}
              className="flex items-center gap-1.5 sm:gap-2 bg-slate-800 hover:bg-slate-700/80 px-2 sm:px-2.5 py-1.5 rounded-xl border border-slate-700 text-xs transition-colors"
            >
              <div className="w-6 h-6 rounded-lg bg-slate-700 flex items-center justify-center text-blue-400 font-bold text-[11px] shrink-0">
                {user?.name.charAt(0) || 'U'}
              </div>
              <div className="text-left hidden sm:block">
                <div className="font-semibold text-slate-200 text-xs leading-none">
                  {user?.name.split(' ')[0]}
                </div>
                <div className="text-[10px] text-blue-400 font-medium leading-none mt-1">
                  {user?.role}
                </div>
              </div>
              <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
            </button>

            {showRoleMenu && (
              <div className="fixed inset-x-3.5 top-16 sm:absolute sm:inset-auto sm:right-0 sm:mt-2 max-w-xs sm:w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-50 text-slate-900 animate-fadeIn">
                <div className="px-4 py-2 border-b border-slate-100">
                  <div className="text-xs font-bold text-slate-900">{user?.name}</div>
                  <div className="text-[11px] text-slate-500 truncate">{user?.email}</div>
                  {user?.docRegistration && (
                    <div className="text-[10px] text-blue-600 font-medium mt-0.5">
                      {user.docRegistration}
                    </div>
                  )}
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                      {user?.role}
                    </span>
                    <span className="text-[10px] font-medium text-slate-500 truncate">
                      {company?.tradeName || company?.name}
                    </span>
                  </div>
                </div>

                {/* User Role Switcher - Permite alternar entre tipos de usuários para demonstrar o app */}
                {canSwitchRoles && (
                  <div className="border-t border-slate-100 mt-1 pt-1.5">
                    <div className="px-4 pb-1 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Alternar Tipo de Usuário
                      </span>
                      <span className="text-[9px] text-blue-600 font-semibold bg-blue-50 px-1.5 py-0.5 rounded">
                        Demonstração
                      </span>
                    </div>

                    <div className="py-1">
                      {roles.map((r) => {
                        const isActive = user?.role === r.role;
                        return (
                          <button
                            key={r.role}
                            onClick={() => {
                              switchRole(r.role);
                              setShowRoleMenu(false);
                              if (onRefreshData) onRefreshData();
                            }}
                            className={`w-full text-left px-4 py-2 text-xs flex items-center justify-between hover:bg-slate-50 transition-colors ${
                              isActive ? 'bg-blue-50/80 font-bold text-blue-700' : 'text-slate-700'
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <div className="flex items-center gap-1.5">
                                {isActive && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                                <span className={isActive ? 'font-bold text-blue-700' : 'font-medium text-slate-800'}>
                                  {r.label}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-400 truncate pl-5">
                                {r.desc}
                              </div>
                            </div>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono shrink-0">
                              {r.role}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {!isInstalled && (
                  <div className="border-t border-slate-100 pt-1 px-2">
                    <button
                      onClick={() => {
                        setShowRoleMenu(false);
                        handleInstallClick();
                      }}
                      className="w-full text-left px-3 py-2 text-xs text-blue-600 hover:bg-blue-50 rounded-lg flex items-center gap-2 transition-colors font-semibold"
                    >
                      <Download className="w-3.5 h-3.5 text-blue-600" />
                      <span>Instalar Aplicativo (PWA)</span>
                    </button>
                  </div>
                )}

                <div className="border-t border-slate-100 mt-1 pt-1 px-2">
                  <button
                    onClick={() => {
                      logout();
                      setShowRoleMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2 transition-colors font-medium"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sair</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showPwaModal && (
        <PwaInstallModal onClose={() => setShowPwaModal(false)} isIOS={isIOS} />
      )}
    </header>
  );
};
