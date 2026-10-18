import React, { useState, useEffect } from 'react';
import {
  Building2,
  KeyRound,
  Plus,
  Edit2,
  Trash2,
  Power,
  Search,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Copy,
  X,
  Building,
  Mail,
  Phone,
  MapPin,
  ShieldAlert,
  Sparkles,
  Lock,
  Database,
  Cloud,
  Check,
  HardDrive,
  Download,
  Upload,
  Wifi,
  WifiOff,
  Smartphone,
  Users,
  UserPlus,
  ArrowLeft,
  ChevronRight,
  UserCheck,
  Shield,
} from 'lucide-react';
import { Company, User, UserRole } from '../types';
import { FirestoreService } from '../lib/firestoreSync';
import {
  countPendingInspectionsIDB,
  getCachedInspectionsIDB,
  clearPendingInspectionsIDB,
} from '../lib/indexedDb';
import {
  syncPendingToFirestore,
  subscribeSyncStatus,
  SyncStatus,
} from '../lib/syncEngine';

export const DevDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'companies' | 'database'>('companies');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  // --- Database Maintenance State ---
  const [clearingDb, setClearingDb] = useState(false);
  const [syncingFirestore, setSyncingFirestore] = useState(false);
  const [restoringFirestore, setRestoringFirestore] = useState(false);
  const [dbStatusMsg, setDbStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // --- IndexedDB & Offline State ---
  const [idbPendingCount, setIdbPendingCount] = useState(0);
  const [idbCachedCount, setIdbCachedCount] = useState(0);
  const [syncingIdb, setSyncingIdb] = useState(false);
  const [isOnlineState, setIsOnlineState] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [swActive, setSwActive] = useState(false);

  const refreshIdbStats = async () => {
    try {
      const pending = await countPendingInspectionsIDB();
      setIdbPendingCount(pending);
      const cached = await getCachedInspectionsIDB();
      setIdbCachedCount(cached.length);
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        setSwActive(true);
      }
    } catch (e) {
      console.error('Error refreshing IDB stats', e);
    }
  };

  useEffect(() => {
    refreshIdbStats();
    const unsub = subscribeSyncStatus((status: SyncStatus) => {
      setIsOnlineState(status.isOnline);
      setIdbPendingCount(status.pendingCount);
      setSyncingIdb(status.isSyncing);
    });
    return unsub;
  }, []);

  // --- Companies State ---
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [searchCompany, setSearchCompany] = useState('');
  
  // Modals for Companies
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [deletingCompany, setDeletingCompany] = useState<Company | null>(null);

  // Company Form state
  const [name, setName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');

  // Manager (Gerente) fields for new company registration
  const [mgrName, setMgrName] = useState('');
  const [mgrEmail, setMgrEmail] = useState('');
  const [mgrPassword, setMgrPassword] = useState('');
  const [mgrPhone, setMgrPhone] = useState('');
  const [mgrDoc, setMgrDoc] = useState('');

  // --- Password Recovery State ---
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchUser, setSearchUser] = useState('');
  const [userToReset, setUserToReset] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetSuccessMessage, setResetSuccessMessage] = useState('');
  const [copied, setCopied] = useState(false);

  // --- User Management within Selected Company ---
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userRole, setUserRole] = useState<UserRole>('GERENTE');
  const [userDoc, setUserDoc] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [userActive, setUserActive] = useState(true);
  const [savingUser, setSavingUser] = useState(false);

  // Fetch companies
  const fetchCompanies = async () => {
    setLoadingCompanies(true);
    try {
      const res = await fetch('/api/companies');
      if (res.ok) {
        const data = await res.json();
        setCompanies(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingCompanies(false);
    }
  };

  // Fetch all users for password recovery
  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch('/api/dev/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
    fetchUsers();
  }, []);

  // --- Company Actions ---
  const handleOpenCreateModal = () => {
    setEditingCompany(null);
    setName('');
    setTradeName('');
    setCnpj('');
    setEmail('');
    setPhone('');
    setAddress('');
    setCity('');
    setState('SP');
    setMgrName('');
    setMgrEmail('');
    setMgrPassword('Cast#' + Math.floor(1000 + Math.random() * 9000));
    setMgrPhone('');
    setMgrDoc('');
    setIsCreateModalOpen(true);
  };

  const handleOpenEditModal = (comp: Company) => {
    setEditingCompany(comp);
    setName(comp.name);
    setTradeName(comp.tradeName || '');
    setCnpj(comp.cnpj);
    setEmail(comp.email);
    setPhone(comp.phone);
    setAddress(comp.address);
    setCity(comp.city || '');
    setState(comp.state || '');
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !cnpj.trim()) return;

    if (editingCompany) {
      // Edit
      try {
        const payload = {
          ...editingCompany,
          name: name.trim().toUpperCase(),
          tradeName: (tradeName.trim() || name.trim()).toUpperCase(),
          cnpj: cnpj.trim().toUpperCase(),
          email: email.trim().toLowerCase(),
          phone: phone.trim().toUpperCase(),
          address: address.trim().toUpperCase(),
          city: (city.trim() || 'São Paulo').toUpperCase(),
          state: (state.trim() || 'SP').toUpperCase(),
        };

        const res = await fetch(`/api/companies/${editingCompany.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          setEditingCompany(null);
          await fetchCompanies();
        } else {
          alert('Erro ao atualizar empresa.');
        }
      } catch (err) {
        alert('Erro de conexão ao atualizar empresa.');
      }
    } else {
      // Create company + Gerente obrigatório
      if (!mgrName.trim() || !mgrEmail.trim()) {
        alert('O cadastro do Gerente (Nome e E-mail) é obrigatório junto ao cadastro da empresa.');
        return;
      }

      try {
        const payload = {
          id: `emp_${Date.now()}`,
          name: name.trim().toUpperCase(),
          tradeName: (tradeName.trim() || name.trim()).toUpperCase(),
          cnpj: cnpj.trim().toUpperCase(),
          email: email.trim().toLowerCase(),
          phone: phone.trim().toUpperCase(),
          address: address.trim().toUpperCase(),
          city: (city.trim() || 'São Paulo').toUpperCase(),
          state: (state.trim() || 'SP').toUpperCase(),
          active: true,
          manager: {
            name: mgrName.trim().toUpperCase(),
            email: mgrEmail.trim().toLowerCase(),
            password: mgrPassword.trim() || 'Cast#' + Math.floor(1000 + Math.random() * 9000),
            phone: mgrPhone.trim().toUpperCase() || undefined,
            docRegistration: mgrDoc.trim().toUpperCase() || undefined,
          },
        };

        const res = await fetch('/api/companies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          setIsCreateModalOpen(false);
          await fetchCompanies();
          await fetchUsers();
        } else {
          const err = await res.json().catch(() => ({}));
          alert(err.error || 'Erro ao cadastrar empresa.');
        }
      } catch (err) {
        alert('Erro de conexão ao cadastrar empresa.');
      }
    }
  };

  const handleToggleStatus = async (comp: Company) => {
    try {
      const res = await fetch(`/api/companies/${comp.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !comp.active }),
      });
      if (res.ok) {
        await fetchCompanies();
      } else {
        alert('Erro ao alterar status da empresa.');
      }
    } catch (e) {
      alert('Erro de conexão ao alterar status.');
    }
  };

  const handleDeleteCompany = async () => {
    if (!deletingCompany) return;
    try {
      const res = await fetch(`/api/companies/${deletingCompany.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setDeletingCompany(null);
        await fetchCompanies();
      } else {
        alert('Não foi possível excluir a empresa.');
      }
    } catch (e) {
      alert('Erro de conexão ao excluir empresa.');
    }
  };

  // --- Password Recovery Actions ---
  const handleOpenResetModal = (usr: User) => {
    setUserToReset(usr);
    setNewPassword('Cast#' + Math.floor(1000 + Math.random() * 9000));
    setResetSuccessMessage('');
    setCopied(false);
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*';
    let pass = 'Cast#';
    for (let i = 0; i < 4; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(pass);
  };

  const handleConfirmPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToReset || !newPassword.trim()) return;

    try {
      const res = await fetch('/api/dev/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userToReset.id,
          newPassword: newPassword.trim(),
        }),
      });

      if (res.ok) {
        setResetSuccessMessage(`Senha redefinida com sucesso para "${newPassword.trim()}".`);
        await fetchUsers();
      } else {
        alert('Erro ao redefinir senha do usuário.');
      }
    } catch (e) {
      alert('Erro de conexão ao redefinir senha.');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const selectedCompany = selectedCompanyId ? companies.find((c) => c.id === selectedCompanyId) || null : null;
  const companyUsers = selectedCompanyId ? users.filter((u) => u.companyId === selectedCompanyId && u.role !== 'DEV') : [];
  const selectedCompanyHasManager = companyUsers.some((u) => u.role === 'GERENTE');
  const filteredCompanyUsers = companyUsers.filter((u) =>
    u.name.toLowerCase().includes(searchUser.toLowerCase()) ||
    u.email.toLowerCase().includes(searchUser.toLowerCase()) ||
    u.role.toLowerCase().includes(searchUser.toLowerCase()) ||
    (u.docRegistration && u.docRegistration.toLowerCase().includes(searchUser.toLowerCase()))
  );

  const handleOpenNewUser = (companyId: string) => {
    const compUsers = users.filter((u) => u.companyId === companyId && u.role !== 'DEV');
    const hasManager = compUsers.some((u) => u.role === 'GERENTE');
    if (hasManager) {
      alert('Esta empresa já possui um Gerente cadastrado. O Desenvolvedor não tem permissão para cadastrar outros funcionários. Os demais funcionários devem ser cadastrados pelo Gerente da empresa.');
      return;
    }
    setEditingUser(null);
    setUserName('');
    setUserEmail('');
    setUserPassword('Cast#' + Math.floor(1000 + Math.random() * 9000));
    setUserRole('GERENTE');
    setUserDoc('');
    setUserPhone('');
    setUserActive(true);
    setIsUserModalOpen(true);
  };

  const handleOpenEditUser = (u: User) => {
    setEditingUser(u);
    setUserName(u.name);
    setUserEmail(u.email);
    setUserPassword('');
    setUserRole(u.role);
    setUserDoc(u.docRegistration || '');
    setUserPhone(u.phone || '');
    setUserActive(u.active ?? true);
    setIsUserModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim() || !userEmail.trim()) return;
    if (!selectedCompanyId) return;

    if (!editingUser && userRole !== 'GERENTE') {
      alert('O Desenvolvedor só pode cadastrar o perfil GERENTE. Os demais colaboradores devem ser cadastrados pelo Gerente da empresa.');
      return;
    }

    setSavingUser(true);
    try {
      const payload: any = {
        name: userName.trim().toUpperCase(),
        email: userEmail.trim().toLowerCase(),
        role: editingUser ? editingUser.role : 'GERENTE',
        companyId: selectedCompanyId,
        docRegistration: userDoc.trim().toUpperCase() || undefined,
        phone: userPhone.trim().toUpperCase() || undefined,
        active: userActive,
      };
      if (userPassword.trim()) {
        payload.password = userPassword.trim();
      }

      const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users';
      const method = editingUser ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-company-id': selectedCompanyId,
          'x-user-role': 'DEV',
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setIsUserModalOpen(false);
        setEditingUser(null);
        await fetchUsers();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Erro ao salvar usuário.');
      }
    } catch (err) {
      alert('Erro de conexão ao salvar usuário.');
    } finally {
      setSavingUser(false);
    }
  };

  const filteredCompanies = companies.filter((c) =>
    c.name.toLowerCase().includes(searchCompany.toLowerCase()) ||
    c.tradeName?.toLowerCase().includes(searchCompany.toLowerCase()) ||
    c.cnpj.includes(searchCompany)
  );

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(searchUser.toLowerCase()) ||
    u.email.toLowerCase().includes(searchUser.toLowerCase()) ||
    u.companyName?.toLowerCase().includes(searchUser.toLowerCase()) ||
    u.role.toLowerCase().includes(searchUser.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-20 w-full max-w-full">
      {/* Dev Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Painel do Desenvolvedor
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Gestão de empresas, isolamento multi-tenant e usuários cadastrados
            </p>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:items-center gap-1.5 sm:gap-2 bg-slate-800/80 border border-slate-700/80 p-1.5 rounded-2xl w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('companies')}
              className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-semibold text-center transition-all ${
                activeTab === 'companies'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20 font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Building2 className="w-4 h-4 shrink-0" />
              <span className="truncate">Empresas ({companies.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('database')}
              className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-semibold text-center transition-all ${
                activeTab === 'database'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20 font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Database className="w-4 h-4 shrink-0" />
              <span className="truncate">Banco & Firebase</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: ABA EMPRESAS (REFORMULADA COM ISOLAMENTO E CARREGAMENTO DE USUÁRIOS) */}
      {/* ========================================================================= */}
      {activeTab === 'companies' && (
        <div className="space-y-4">
          {/* SE UMA EMPRESA ESTIVER SELECIONADA: DRILL-DOWN DOS USUÁRIOS DESSA EMPRESA */}
          {selectedCompanyId && selectedCompany ? (
            <div className="space-y-5 animate-fadeIn">
              {/* Barra de Navegação Superior e Alternância Direta */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    onClick={() => {
                      setSelectedCompanyId(null);
                      setSearchUser('');
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors shrink-0"
                  >
                    <ArrowLeft className="w-4 h-4 text-slate-600" />
                    <span>← Voltar para Lista de Empresas</span>
                  </button>

                  <div className="h-5 w-px bg-slate-200 hidden sm:block" />

                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500 font-medium hidden md:inline">Alternar empresa:</span>
                    <select
                      value={selectedCompany.id}
                      onChange={(e) => {
                        setSelectedCompanyId(e.target.value);
                        setSearchUser('');
                      }}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-cyan-500 outline-none"
                    >
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.tradeName || c.name} ({users.filter((u) => u.companyId === c.id).length} usuários)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenEditModal(selectedCompany)}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                    <span>Editar Empresa</span>
                  </button>

                  <button
                    onClick={() => handleOpenNewUser(selectedCompany.id)}
                    className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-md shadow-cyan-600/20 transition-all active:scale-95 shrink-0"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>+ Adicionar Usuário nesta Empresa</span>
                  </button>
                </div>
              </div>

              {/* Resumo da Empresa Selecionada */}
              <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-5 sm:p-6 rounded-3xl border border-slate-800 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 border border-cyan-500/30">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg sm:text-xl font-bold text-white">
                        {selectedCompany.tradeName || selectedCompany.name}
                      </h2>
                      {selectedCompany.active ? (
                        <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Ativa
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Power className="w-3 h-3" /> Inativa
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-300 mt-1">{selectedCompany.name}</p>
                    <div className="flex items-center gap-3 sm:gap-4 mt-2 text-xs text-slate-400 flex-wrap">
                      <span>CNPJ: <strong className="font-mono text-slate-200">{selectedCompany.cnpj}</strong></span>
                      {selectedCompany.city && <span>• {selectedCompany.city}/{selectedCompany.state}</span>}
                      {selectedCompany.email && <span>• {selectedCompany.email}</span>}
                      {selectedCompany.phone && <span>• {selectedCompany.phone}</span>}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-800/90 border border-slate-700/80 p-3.5 rounded-2xl text-xs space-y-1 md:text-right shrink-0">
                  <div className="text-[11px] text-slate-400 font-medium">Usuários nesta empresa</div>
                  <div className="text-2xl font-black text-cyan-400">
                    {companyUsers.length} <span className="text-xs font-normal text-slate-400">cadastrado(s)</span>
                  </div>
                </div>
              </div>

              {/* Banner de Garantia de Isolamento Multi-tenant */}
              <div className="p-4 rounded-2xl bg-cyan-50/90 border border-cyan-200 text-cyan-950 text-xs flex items-start gap-3 shadow-xs">
                <Shield className="w-4 h-4 text-cyan-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Isolamento Multi-empresa Rigoroso Ativo:</span>{' '}
                  Os usuários listados abaixo têm acesso <strong>única e exclusivamente</strong> aos dados, condomínios, clientes e vistorias vinculados à empresa{' '}
                  <strong>{selectedCompany.tradeName || selectedCompany.name}</strong>. Nenhum dado é compartilhado entre empresas distintas, garantindo sigilo e separação total de informações.
                </div>
              </div>

              {/* Tabela de Usuários Exclusivos desta Empresa */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200">
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={searchUser}
                      onChange={(e) => setSearchUser(e.target.value.toUpperCase())}
                      placeholder="BUSCAR USUÁRIO POR NOME, E-MAIL OU PERFIL..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs font-medium focus:ring-2 focus:ring-cyan-500 outline-none uppercase"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    {!selectedCompanyHasManager ? (
                      <button
                        onClick={() => handleOpenNewUser(selectedCompany.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 rounded-xl text-white text-xs font-bold transition-colors shadow-xs"
                        title="Cadastrar Gerente da Empresa"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>+ Cadastrar Gerente</span>
                      </button>
                    ) : (
                      <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 border border-purple-200 text-purple-900 rounded-xl text-[11px] font-bold">
                        <Shield className="w-3.5 h-3.5 text-purple-600" />
                        <span>Gerente Ativo</span>
                      </div>
                    )}
                    <button
                      onClick={fetchUsers}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600 text-xs font-semibold transition-colors"
                      title="Atualizar lista de usuários"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingUsers ? 'animate-spin' : ''}`} />
                      <span>Atualizar</span>
                    </button>
                  </div>
                </div>

                {/* Banner Informativo da Regra de Permissões */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs flex items-start gap-2.5">
                  <Shield className="w-4 h-4 text-purple-600 mt-0.5 shrink-0" />
                  <div className="text-slate-600">
                    <span className="font-bold text-slate-900">Política de Acesso:</span> O Desenvolvedor inclui apenas o Gerente da empresa. Os demais funcionários (Técnicos e Síndicos) devem ser cadastrados exclusivamente pelo próprio <strong>Gerente</strong> da empresa.
                  </div>
                </div>

                {companyUsers.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-3 shadow-xs">
                    <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center mx-auto">
                      <Shield className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Nenhum gerente cadastrado nesta empresa</h4>
                    </div>
                    <button
                      onClick={() => handleOpenNewUser(selectedCompany.id)}
                      className="inline-flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm transition-all"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>+ Cadastrar Gerente da Empresa</span>
                    </button>
                  </div>
                ) : (
                  <div className="w-full max-w-full space-y-3">
                    {/* Mobile View: Cards (No horizontal scroll, 100% fits within screen) */}
                    <div className="md:hidden space-y-3">
                      {filteredCompanyUsers.map((u) => (
                        <div
                          key={u.id}
                          className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5 flex-wrap">
                                <span>{u.name}</span>
                                {u.role === 'DEV' && (
                                  <span className="text-[9px] bg-cyan-100 text-cyan-800 font-bold px-1.5 py-0.5 rounded">
                                    DEV
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-500 font-mono break-all mt-0.5">
                                {u.email}
                              </div>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                                u.role === 'DEV'
                                  ? 'bg-cyan-100 text-cyan-800'
                                  : u.role === 'GERENTE' || (u.role as string) === 'SUPERVISOR'
                                  ? 'bg-purple-100 text-purple-800'
                                  : u.role === 'TECNICO'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {u.role}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 pt-2 border-t border-slate-100">
                            <div>
                              <span className="text-slate-400 block text-[10px]">Registro Profissional:</span>
                              <span className="font-semibold text-slate-700">{u.docRegistration || '—'}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px]">Status:</span>
                              {u.active ? (
                                <span className="text-emerald-700 font-bold flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                                  Ativo
                                </span>
                              ) : (
                                <span className="text-rose-600 font-bold flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block" />
                                  Inativo
                                </span>
                              )}
                            </div>
                          </div>

                          {u.phone && (
                            <div className="text-[11px] text-slate-600">
                              <span className="text-slate-400 text-[10px]">Telefone: </span>
                              <span className="font-medium text-slate-700">{u.phone}</span>
                            </div>
                          )}

                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                            <button
                              onClick={() => handleOpenResetModal(u)}
                              className="flex-1 inline-flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-cyan-300 hover:text-cyan-200 text-xs font-bold px-3 py-2 rounded-xl shadow-xs transition-colors"
                            >
                              <KeyRound className="w-3.5 h-3.5 text-cyan-400" />
                              <span>Redefinir Senha</span>
                            </button>
                            <button
                              onClick={() => handleOpenEditUser(u)}
                              className="p-2 border border-slate-200 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors"
                              title="Editar usuário"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Desktop View: Table */}
                    <div className="hidden md:block bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs w-full max-w-full">
                      <div className="overflow-x-auto w-full max-w-full">
                        <table className="w-full text-left text-xs text-slate-700 min-w-[650px]">
                          <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                            <tr>
                              <th className="px-4 py-3">Usuário</th>
                              <th className="px-4 py-3">Perfil (Role)</th>
                              <th className="px-4 py-3">Registro Profissional</th>
                              <th className="px-4 py-3">Telefone</th>
                              <th className="px-4 py-3">Status</th>
                              <th className="px-4 py-3 text-right">Ações Dev</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {filteredCompanyUsers.map((u) => (
                              <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="px-4 py-3">
                                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                    <span>{u.name}</span>
                                    {u.role === 'DEV' && (
                                      <span className="text-[9px] bg-cyan-100 text-cyan-800 font-bold px-1.5 py-0.2 rounded">
                                        DEV
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-500 font-mono">{u.email}</div>
                                </td>
                                <td className="px-4 py-3">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      u.role === 'DEV'
                                        ? 'bg-cyan-100 text-cyan-800'
                                        : u.role === 'GERENTE' || (u.role as string) === 'SUPERVISOR'
                                        ? 'bg-purple-100 text-purple-800'
                                        : u.role === 'TECNICO'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-amber-100 text-amber-800'
                                    }`}
                                  >
                                    {u.role}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-slate-600">
                                  {u.docRegistration || '—'}
                                </td>
                                <td className="px-4 py-3 text-slate-600">
                                  {u.phone || '—'}
                                </td>
                                <td className="px-4 py-3">
                                  {u.active ? (
                                    <span className="text-emerald-700 text-[11px] font-medium flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                                      Ativo
                                    </span>
                                  ) : (
                                    <span className="text-rose-600 text-[11px] font-medium flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block" />
                                      Inativo
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      onClick={() => handleOpenResetModal(u)}
                                      className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-cyan-300 hover:text-cyan-200 text-xs font-bold px-3 py-1.5 rounded-xl shadow-xs transition-colors"
                                      title="Redefinir ou recuperar senha"
                                    >
                                      <KeyRound className="w-3.5 h-3.5 text-cyan-400" />
                                      <span>Redefinir Senha</span>
                                    </button>

                                    <button
                                      onClick={() => handleOpenEditUser(u)}
                                      className="p-1.5 border border-slate-200 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors"
                                      title="Editar usuário"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* SE NENHUMA EMPRESA ESTIVER SELECIONADA: LISTA DAS EMPRESAS CADASTRADAS */
            <div className="space-y-4 animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={searchCompany}
                    onChange={(e) => setSearchCompany(e.target.value.toUpperCase())}
                    placeholder="BUSCAR EMPRESA POR RAZÃO SOCIAL, NOME FANTASIA OU CNPJ..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium focus:ring-2 focus:ring-cyan-500 outline-none uppercase"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      fetchCompanies();
                      fetchUsers();
                    }}
                    className="p-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600 transition-colors"
                    title="Atualizar lista"
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingCompanies ? 'animate-spin' : ''}`} />
                  </button>

                  <button
                    onClick={handleOpenCreateModal}
                    className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs sm:text-sm font-bold px-4 py-2 rounded-xl shadow-md shadow-cyan-600/20 transition-all active:scale-95 shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Criar Nova Empresa</span>
                  </button>
                </div>
              </div>

              {/* Companies Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredCompanies.map((c) => {
                  const compUsers = users.filter((u) => u.companyId === c.id);
                  return (
                    <div
                      key={c.id}
                      className={`bg-white border rounded-2xl p-5 shadow-xs flex flex-col justify-between transition-all hover:shadow-md ${
                        c.active
                          ? 'border-slate-200 hover:border-cyan-400'
                          : 'border-rose-200 bg-rose-50/20 opacity-80'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm ${
                                c.active ? 'bg-cyan-100 text-cyan-800' : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              <Building2 className="w-6 h-6" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-base font-bold text-slate-900">
                                  {c.tradeName || c.name}
                                </h3>
                                {c.active ? (
                                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" /> Ativa
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <Power className="w-3 h-3" /> Desativada
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5">{c.name}</p>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 text-xs text-slate-600 space-y-1.5 pt-3 border-t border-slate-100">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-700">CNPJ:</span>
                            <span className="font-mono text-slate-900 font-medium">{c.cnpj}</span>
                          </div>
                          {c.email && (
                            <div className="flex items-center gap-2 text-slate-500">
                              <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>{c.email}</span>
                            </div>
                          )}
                          {c.phone && (
                            <div className="flex items-center gap-2 text-slate-500">
                              <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>{c.phone}</span>
                            </div>
                          )}
                          {c.address && (
                            <div className="flex items-center gap-2 text-slate-500">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>{c.address} - {c.city}/{c.state}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Botão de Acesso Exclusivo aos Usuários da Empresa */}
                      <div className="mt-4 pt-3 border-t border-slate-100 space-y-3">
                        <button
                          onClick={() => setSelectedCompanyId(c.id)}
                          className="w-full flex items-center justify-between bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs transition-all active:scale-[0.99] group"
                        >
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-cyan-400" />
                            <span>Ver Usuários Desta Empresa</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-md text-[11px] font-semibold border border-cyan-500/30">
                              {compUsers.length} usuário(s)
                            </span>
                            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-cyan-300 group-hover:translate-x-0.5 transition-all" />
                          </div>
                        </button>

                        {/* Dev Secondary Actions */}
                        <div className="flex items-center justify-between gap-2 pt-1">
                          <span className="text-[11px] text-slate-400 font-mono">
                            ID: {c.id}
                          </span>

                          <div className="flex items-center gap-1.5">
                            {/* Toggle Active/Inactive */}
                            <button
                              onClick={() => handleToggleStatus(c)}
                              className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-xl border transition-colors ${
                                c.active
                                  ? 'border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100'
                                  : 'border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                              }`}
                              title={c.active ? 'Desativar empresa' : 'Ativar empresa'}
                            >
                              <Power className="w-3.5 h-3.5" />
                              <span>{c.active ? 'Desativar' : 'Ativar'}</span>
                            </button>

                            {/* Edit */}
                            <button
                              onClick={() => handleOpenEditModal(c)}
                              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-slate-200 text-slate-700 bg-slate-50 hover:bg-slate-100 transition-colors"
                              title="Editar dados da empresa"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span>Editar</span>
                            </button>

                            {/* Delete */}
                            <button
                              onClick={() => setDeletingCompany(c)}
                              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 transition-colors"
                              title="Excluir permanentemente"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Excluir</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CRIAR / EDITAR EMPRESA                                             */}
      {/* ========================================================================= */}
      {(isCreateModalOpen || editingCompany) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn w-full max-w-full overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-4 sm:p-7 shadow-2xl border border-slate-100 my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-cyan-100 text-cyan-800 flex items-center justify-center">
                  <Building className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingCompany ? 'Editar Empresa' : 'Cadastrar Empresa e Gerente'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setEditingCompany(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCompany} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Razão Social *
                </label>
                <input
                  required
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value.toUpperCase())}
                  placeholder="EX: ENGENHARIA E VISTORIAS LTDA"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-cyan-500 outline-none uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nome Fantasia
                </label>
                <input
                  type="text"
                  value={tradeName}
                  onChange={(e) => setTradeName(e.target.value.toUpperCase())}
                  placeholder="EX: PRIME VISTORIAS"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-cyan-500 outline-none uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  CNPJ *
                </label>
                <input
                  required
                  type="text"
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value.toUpperCase())}
                  placeholder="00.000.000/0001-00"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-cyan-500 outline-none font-mono uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">E-mail da Empresa</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value.toLowerCase())}
                    placeholder="contato@empresa.com"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-cyan-500 outline-none lowercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Telefone da Empresa</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.toUpperCase())}
                    placeholder="(11) 3333-4444"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-cyan-500 outline-none uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Endereço</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value.toUpperCase())}
                  placeholder="RUA / AVENIDA, NÚMERO, BAIRRO"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-cyan-500 outline-none uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Cidade</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value.toUpperCase())}
                    placeholder="SÃO PAULO"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-cyan-500 outline-none uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">UF / Estado</label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value.toUpperCase())}
                    placeholder="SP"
                    maxLength={2}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-cyan-500 outline-none uppercase"
                  />
                </div>
              </div>

              {/* Seção do Gerente Responsável (Obrigatório ao cadastrar empresa) */}
              {!editingCompany && (
                <div className="pt-3 border-t border-slate-200 space-y-3">
                  <div className="bg-purple-50 border border-purple-200 rounded-2xl p-3.5 space-y-1">
                    <div className="flex items-center gap-2 text-purple-900 font-bold text-xs">
                      <Shield className="w-4 h-4 text-purple-600" />
                      <span>Gerente Responsável da Empresa (Obrigatório)</span>
                    </div>
                    <p className="text-[11px] text-purple-700 leading-relaxed">
                      O Gerente é o administrador operacional da empresa no sistema. Ele será o único responsável por cadastrar os demais funcionários da equipe (Técnicos e Síndicos).
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nome do Gerente *
                    </label>
                    <input
                      required
                      type="text"
                      value={mgrName}
                      onChange={(e) => setMgrName(e.target.value.toUpperCase())}
                      placeholder="EX: ENG. CARLOS EDUARDO"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-cyan-500 outline-none uppercase"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        E-mail de Login do Gerente *
                      </label>
                      <input
                        required
                        type="email"
                        value={mgrEmail}
                        onChange={(e) => setMgrEmail(e.target.value.toLowerCase())}
                        placeholder="gerente@empresa.com.br"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-cyan-500 outline-none lowercase"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Senha Inicial do Gerente *
                      </label>
                      <input
                        required
                        type="text"
                        value={mgrPassword}
                        onChange={(e) => setMgrPassword(e.target.value)}
                        placeholder="Senha de acesso"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-medium focus:ring-2 focus:ring-cyan-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Registro Profissional (CREA / CFT)
                      </label>
                      <input
                        type="text"
                        value={mgrDoc}
                        onChange={(e) => setMgrDoc(e.target.value.toUpperCase())}
                        placeholder="EX: CREA-SP 5061234"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-cyan-500 outline-none uppercase"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Telefone / Celular
                      </label>
                      <input
                        type="text"
                        value={mgrPhone}
                        onChange={(e) => setMgrPhone(e.target.value.toUpperCase())}
                        placeholder="(11) 98765-4321"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-cyan-500 outline-none uppercase"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setEditingCompany(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 rounded-xl shadow-sm transition-colors"
                >
                  {editingCompany ? 'Salvar Alterações' : 'Cadastrar Empresa e Gerente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CONFIRMAÇÃO DE EXCLUSÃO DE EMPRESA                                 */}
      {/* ========================================================================= */}
      {deletingCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn w-full max-w-full overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-4 sm:p-6 shadow-2xl border border-rose-100 my-auto">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Excluir Empresa (Dev)</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Você tem certeza que deseja excluir permanentemente a empresa{' '}
              <strong className="text-slate-900">{deletingCompany.tradeName || deletingCompany.name}</strong> (CNPJ: {deletingCompany.cnpj})?
            </p>

            <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Esta ação é irreversível e remove o acesso de todos os usuários vinculados a este CNPJ.
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 mt-5 pt-3 border-t border-slate-100">
              <button
                onClick={() => setDeletingCompany(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteCompany}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-sm transition-colors"
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: RECUPERAR SENHA DE USUÁRIO                                         */}
      {/* ========================================================================= */}
      {userToReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn w-full max-w-full overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-4 sm:p-6 shadow-2xl border border-slate-100 my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-cyan-100 text-cyan-800 flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Recuperar Senha</h3>
                  <p className="text-[11px] text-slate-500">{userToReset.name}</p>
                </div>
              </div>
              <button onClick={() => setUserToReset(null)} className="text-slate-400 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            {resetSuccessMessage ? (
              <div className="mt-4 space-y-4">
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Senha Redefinida com Sucesso!</span>
                  </div>
                  <p className="text-xs text-emerald-700">
                    A nova credencial de acesso para <strong>{userToReset.email}</strong> foi salva no sistema:
                  </p>
                  <div className="flex items-center justify-between bg-white border border-emerald-300 rounded-xl p-2.5 font-mono text-xs font-black text-slate-900">
                    <span>{newPassword}</span>
                    <button
                      onClick={() => copyToClipboard(newPassword)}
                      className="flex items-center gap-1 text-[11px] text-emerald-700 hover:text-emerald-900 font-sans font-bold bg-emerald-100 px-2 py-1 rounded-lg"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copied ? 'Copiado!' : 'Copiar'}</span>
                    </button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => setUserToReset(null)}
                    className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl"
                  >
                    Concluir
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleConfirmPasswordReset} className="mt-4 space-y-3.5">
                <div className="text-xs text-slate-600">
                  <span className="font-semibold text-slate-700">E-mail de acesso:</span>{' '}
                  <code className="font-mono text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded">
                    {userToReset.email}
                  </code>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nova Senha de Acesso
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      required
                      type="text"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Digite a nova senha"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-mono font-medium focus:ring-2 focus:ring-cyan-500 outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-start">
                  <button
                    type="button"
                    onClick={generateRandomPassword}
                    className="flex items-center gap-1.5 text-xs text-cyan-700 hover:text-cyan-800 font-semibold"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-cyan-600" />
                    <span>Gerar Senha Aleatória Segura</span>
                  </button>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setUserToReset(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 rounded-xl shadow-sm transition-colors"
                  >
                    Confirmar Redefinição
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADICIONAR / EDITAR USUÁRIO NA EMPRESA                              */}
      {/* ========================================================================= */}
      {isUserModalOpen && selectedCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn w-full max-w-full overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-slate-100 my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-cyan-100 text-cyan-800 flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {editingUser ? 'Editar Usuário' : 'Cadastrar Gerente da Empresa'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Empresa: <strong>{selectedCompany.tradeName || selectedCompany.name}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsUserModalOpen(false);
                  setEditingUser(null);
                }}
                className="text-slate-400 p-1 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nome Completo *
                </label>
                <input
                  required
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value.toUpperCase())}
                  placeholder="EX: ENG. ROBERTO CARLOS"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-cyan-500 outline-none uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  E-mail de Login *
                </label>
                <input
                  required
                  type="email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value.toLowerCase())}
                  placeholder="gerente@empresa.com.br"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-cyan-500 outline-none lowercase"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Perfil de Acesso (Role) *
                  </label>
                  {editingUser ? (
                    <div className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 flex items-center justify-between">
                      <span>{editingUser.role}</span>
                      <span className="text-[10px] text-slate-500 font-medium">Perfil Fixo</span>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="w-full bg-purple-50 border border-purple-200 rounded-xl px-3 py-2 text-xs font-bold text-purple-900 flex items-center justify-between">
                        <span>GERENTE</span>
                        <span className="text-[10px] bg-purple-200 text-purple-800 font-bold px-1.5 py-0.5 rounded">Obrigatório</span>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-tight">
                        O desenvolvedor só cadastra o Gerente. Demais funcionários são cadastrados pelo próprio Gerente.
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {editingUser ? 'Nova Senha (Opcional)' : 'Senha Inicial *'}
                  </label>
                  <input
                    type="text"
                    value={userPassword}
                    onChange={(e) => setUserPassword(e.target.value)}
                    placeholder={editingUser ? 'Manter senha atual' : 'Senha de acesso'}
                    required={!editingUser}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-medium focus:ring-2 focus:ring-cyan-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Registro Profissional (CREA / CFT)
                  </label>
                  <input
                    type="text"
                    value={userDoc}
                    onChange={(e) => setUserDoc(e.target.value.toUpperCase())}
                    placeholder="EX: CREA-SP 123456/D"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-cyan-500 outline-none uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Telefone / WhatsApp
                  </label>
                  <input
                    type="text"
                    value={userPhone}
                    onChange={(e) => setUserPhone(e.target.value.toUpperCase())}
                    placeholder="(11) 98765-4321"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-cyan-500 outline-none uppercase"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="userActiveCheck"
                  checked={userActive}
                  onChange={(e) => setUserActive(e.target.checked)}
                  className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                />
                <label htmlFor="userActiveCheck" className="text-xs font-medium text-slate-700 cursor-pointer">
                  Usuário Ativo (Pode realizar login no sistema)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsUserModalOpen(false);
                    setEditingUser(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingUser}
                  className="px-5 py-2 text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 rounded-xl shadow-sm transition-colors flex items-center gap-2"
                >
                  {savingUser && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingUser ? 'Salvar Alterações' : 'Cadastrar Usuário'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: BANCO DE DADOS & PERSISTÊNCIA FIREBASE                              */}
      {/* ========================================================================= */}
      {activeTab === 'database' && (
        <div className="space-y-6">
          {/* Status Message */}
          {dbStatusMsg && (
            <div
              className={`p-4 rounded-2xl flex items-center justify-between text-xs font-semibold ${
                dbStatusMsg.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              <div className="flex items-center gap-2">
                {dbStatusMsg.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                )}
                <span>{dbStatusMsg.text}</span>
              </div>
              <button
                onClick={() => setDbStatusMsg(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Database Actions Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Card 1: Limpeza de Modelos e Vistorias */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Limpar Modelos e Vistorias
                    </h3>
                    <p className="text-xs text-slate-500">
                      Mantém estritamente os usuários cadastrados e empresas
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                disabled={clearingDb}
                onClick={async () => {
                  if (!confirm('Deseja realmente limpar o banco de dados de modelos e vistorias? Os usuários cadastrados serão mantidos.')) {
                    return;
                  }
                  setClearingDb(true);
                  setDbStatusMsg(null);
                  try {
                    const res = await fetch('/api/dev/clean-database', { method: 'POST' });
                    const data = await res.json();
                    if (res.ok) {
                      // Also clear from Firestore for consistency
                      try {
                        await FirestoreService.clearTemplatesAndInspectionsInFirestore();
                      } catch (fErr) {
                        console.warn('Aviso ao sincronizar exclusão com Firestore:', fErr);
                      }
                      setDbStatusMsg({
                        type: 'success',
                        text: 'Banco de dados limpo com sucesso! Modelos e vistorias foram removidos. Usuários preservados.',
                      });
                    } else {
                      setDbStatusMsg({ type: 'error', text: data.error || 'Erro ao limpar banco de dados.' });
                    }
                  } catch (e: any) {
                    setDbStatusMsg({ type: 'error', text: `Erro de conexão: ${e.message}` });
                  } finally {
                    setClearingDb(false);
                  }
                }}
                className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold py-3 px-4 rounded-xl shadow-sm transition-all active:scale-98 disabled:opacity-50"
              >
                {clearingDb ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Limpando dados...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Executar Limpeza de Modelos & Vistorias</span>
                  </>
                )}
              </button>
            </div>

            {/* Card 2: Persistência Firebase Firestore */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
                    <Cloud className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Banco Persistente no Firebase
                    </h3>
                    <p className="text-xs text-slate-500">
                      Garante que dados não sejam apagados após novo deploy
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  disabled={syncingFirestore}
                  onClick={async () => {
                    setSyncingFirestore(true);
                    setDbStatusMsg(null);
                    try {
                      const res = await fetch('/api/dev/db-state');
                      const state = await res.json();
                      await FirestoreService.pushFullStateToFirestore(state);
                      setDbStatusMsg({
                        type: 'success',
                        text: 'Dados gravados no Firebase Firestore com sucesso! O banco agora é persistente na nuvem.',
                      });
                    } catch (e: any) {
                      setDbStatusMsg({ type: 'error', text: `Erro ao sincronizar com Firebase: ${e.message}` });
                    } finally {
                      setSyncingFirestore(false);
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold py-3 px-4 rounded-xl shadow-sm transition-all active:scale-98 disabled:opacity-50"
                >
                  {syncingFirestore ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Gravando no Firebase Firestore...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>Salvar / Sincronizar Tudo no Firebase</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={restoringFirestore}
                  onClick={async () => {
                    if (!confirm('Deseja restaurar os dados salvos no Firebase Firestore? Isso sincronizará as coleções na nuvem com a base da aplicação.')) {
                      return;
                    }
                    setRestoringFirestore(true);
                    setDbStatusMsg(null);
                    try {
                      const cloudState = await FirestoreService.pullFullStateFromFirestore();
                      const res = await fetch('/api/dev/db-restore', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(cloudState),
                      });
                      if (res.ok) {
                        await fetchCompanies();
                        await fetchUsers();
                        setDbStatusMsg({
                          type: 'success',
                          text: 'Dados restaurados com sucesso a partir do Firebase Firestore!',
                        });
                      } else {
                        throw new Error('Falha ao aplicar restauração no servidor.');
                      }
                    } catch (e: any) {
                      setDbStatusMsg({ type: 'error', text: `Erro ao restaurar do Firebase: ${e.message}` });
                    } finally {
                      setRestoringFirestore(false);
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold py-2.5 px-4 rounded-xl transition-colors disabled:opacity-50"
                >
                  {restoringFirestore ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Restaurando da Nuvem...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Restaurar Dados do Firebase</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Card 3: IndexedDB & Service Worker (Offline First) */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Modo Offline & IndexedDB
                    </h3>
                    <p className="text-xs text-slate-500">
                      Camada PWA & Sincronização em segundo plano
                    </p>
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Service Worker:</span>
                    <span className="font-semibold flex items-center gap-1 text-emerald-600">
                      <Check className="w-3.5 h-3.5" /> Ativo & Instalado
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Status de Rede:</span>
                    <span className={`font-semibold flex items-center gap-1 ${isOnlineState ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {isOnlineState ? (
                        <>
                          <Wifi className="w-3.5 h-3.5" /> Online
                        </>
                      ) : (
                        <>
                          <WifiOff className="w-3.5 h-3.5" /> Offline
                        </>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Pendentes IndexedDB:</span>
                    <span className="font-bold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-md">
                      {idbPendingCount} vistorias
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Cache Local IndexedDB:</span>
                    <span className="font-semibold text-slate-700">
                      {idbCachedCount} registradas
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Permite realizar vistorias completas com fotos sem conexão. O Service Worker e o Sync Engine salvam no IndexedDB e sincronizam com o Firestore assim que a conexão restabelece.
                </p>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  disabled={syncingIdb || idbPendingCount === 0 || !isOnlineState}
                  onClick={async () => {
                    setSyncingIdb(true);
                    setDbStatusMsg(null);
                    try {
                      const res = await syncPendingToFirestore();
                      await refreshIdbStats();
                      setDbStatusMsg({
                        type: 'success',
                        text: `Sincronização concluída! ${res.successCount} vistorias enviadas com sucesso ao Firebase Firestore.`,
                      });
                    } catch (e: any) {
                      setDbStatusMsg({ type: 'error', text: `Erro na sincronização: ${e.message}` });
                    } finally {
                      setSyncingIdb(false);
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-3 px-4 rounded-xl shadow-sm transition-all active:scale-98 disabled:opacity-50 cursor-pointer"
                >
                  {syncingIdb ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Sincronizando com Firestore...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      <span>Sincronizar Pendentes ({idbPendingCount}) Agora</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={idbPendingCount === 0}
                  onClick={async () => {
                    if (!confirm('Deseja limpar a fila de vistorias pendentes do IndexedDB?')) return;
                    await clearPendingInspectionsIDB();
                    await refreshIdbStats();
                    setDbStatusMsg({
                      type: 'success',
                      text: 'Fila de vistorias pendentes no IndexedDB foi limpa com sucesso.',
                    });
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold py-2.5 px-4 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 text-slate-400" />
                  <span>Limpar Fila Pendente</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
