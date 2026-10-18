import React, { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  CheckCircle2,
  ExternalLink,
  Shield,
  Phone,
  Mail,
  MapPin,
  X,
  Loader2,
  HardDrive,
  CloudUpload,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Company } from '../types';
import {
  connectCompanyGoogleDrive,
  disconnectCompanyGoogleDrive,
} from '../services/driveService';

export const CompaniesPage: React.FC = () => {
  const { user, company, availableCompanies, switchCompany, canManageCompanies } = useAuth();
  const [companies, setCompanies] = useState<Company[]>(availableCompanies);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [connectingDriveCompanyId, setConnectingDriveCompanyId] = useState<string | null>(null);

  // Form
  const [name, setName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/companies');
      if (res.ok) {
        const data = await res.json();
        setCompanies(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const payload: Partial<Company> = {
      name: name.trim().toUpperCase(),
      tradeName: (tradeName.trim() || name.trim()).toUpperCase(),
      cnpj: (cnpj.trim() || '00.000.000/0001-00').toUpperCase(),
      email: (email.trim() || 'contato@empresa.com.br').toLowerCase(),
      phone: (phone.trim() || '(11) 3000-0000').toUpperCase(),
      address: (address.trim() || 'Av. Comercial, 100').toUpperCase(),
      active: true,
    };

    try {
      const res = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const newComp = await res.json();
        setIsModalOpen(false);
        setName('');
        setTradeName('');
        setCnpj('');
        setEmail('');
        setPhone('');
        setAddress('');
        await fetchCompanies();
        switchCompany(newComp.id);
      }
    } catch (e) {
      alert('Erro ao cadastrar empresa.');
    }
  };

  const handleConnectDrive = async (comp: Company) => {
    if (!canManageCompanies) {
      alert('Acesso restrito: Apenas administradores podem configurar o Google Drive corporativo.');
      return;
    }

    try {
      setConnectingDriveCompanyId(comp.id);
      const { config } = await connectCompanyGoogleDrive(comp.id, {
        id: user?.id || 'admin',
        name: user?.name || 'Administrador',
      });
      alert(`Google Drive (${config.email}) vinculado com sucesso para a empresa ${comp.name}!`);
      await fetchCompanies();
    } catch (err: any) {
      console.error('Erro ao conectar Google Drive:', err);
      alert(`Falha ao conectar Google Drive: ${err.message || err}`);
    } finally {
      setConnectingDriveCompanyId(null);
    }
  };

  const handleDisconnectDrive = async (comp: Company) => {
    if (!canManageCompanies) {
      alert('Acesso restrito: Apenas administradores podem desvincular o Google Drive.');
      return;
    }

    try {
      setConnectingDriveCompanyId(comp.id);
      const ok = await disconnectCompanyGoogleDrive(comp.id);
      if (ok) {
        alert('Google Drive desvinculado com sucesso.');
        await fetchCompanies();
      } else {
        alert('Erro ao desvincular Google Drive.');
      }
    } catch (err: any) {
      alert(`Erro: ${err.message || err}`);
    } finally {
      setConnectingDriveCompanyId(null);
    }
  };

  return (
    <div className="space-y-6 pb-16 w-full max-w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900">
            Estrutura Multiempresa (Multi-Tenant)
          </h1>
        </div>

        {canManageCompanies && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl shadow-md shadow-blue-600/20 transition-all active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Empresa</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {companies.map((c) => {
          const isActive = company?.id === c.id;

          return (
            <div
              key={c.id}
              className={`bg-white border rounded-2xl p-5 shadow-xs flex flex-col justify-between transition-all ${
                isActive ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                        isActive
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        {c.tradeName || c.name}
                      </h3>
                      <p className="text-xs text-slate-500">{c.name}</p>
                    </div>
                  </div>

                  {isActive ? (
                    <span className="flex items-center gap-1 text-[11px] font-bold bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Ativa Agora
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                      Isolada
                    </span>
                  )}
                </div>

                <div className="mt-4 text-xs text-slate-600 space-y-1.5 pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-700">CNPJ:</span>
                    <span>{c.cnpj}</span>
                  </div>
                  {c.email && (
                    <div className="flex items-center gap-2 text-slate-500">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span>{c.email}</span>
                    </div>
                  )}
                  {c.phone && (
                    <div className="flex items-center gap-2 text-slate-500">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{c.phone}</span>
                    </div>
                  )}
                  {c.address && (
                    <div className="flex items-center gap-2 text-slate-500">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{c.address}</span>
                    </div>
                  )}

                  {/* Google Drive Status for Company */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100/80">
                    <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200/80">
                      <div className="flex items-center gap-2 min-w-0">
                        <HardDrive className={`w-4 h-4 shrink-0 ${c.googleDriveConfig?.connected ? 'text-emerald-600' : 'text-slate-400'}`} />
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold text-slate-800 flex items-center gap-1.5 truncate">
                            <span>Google Drive Corporativo</span>
                            {c.googleDriveConfig?.connected ? (
                              <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">
                                Conectado
                              </span>
                            ) : (
                              <span className="text-[9px] font-medium text-slate-500 bg-slate-200/60 px-1.5 py-0.2 rounded">
                                Desconectado
                              </span>
                            )}
                          </p>
                          <p className="text-[10px] text-slate-500 truncate">
                            {c.googleDriveConfig?.connected
                              ? c.googleDriveConfig.email || 'Conta Corporativa'
                              : 'Armazenamento em nuvem para fotos e relatórios'}
                          </p>
                        </div>
                      </div>

                      {canManageCompanies && (
                        <div>
                          {c.googleDriveConfig?.connected ? (
                            <button
                              type="button"
                              disabled={connectingDriveCompanyId === c.id}
                              onClick={() => handleDisconnectDrive(c)}
                              className="text-[10px] font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 py-1 rounded-lg border border-rose-200 transition-colors disabled:opacity-50 shrink-0"
                              title="Desvincular Google Drive desta empresa"
                            >
                              {connectingDriveCompanyId === c.id ? 'Aguarde...' : 'Desvincular'}
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={connectingDriveCompanyId === c.id}
                              onClick={() => handleConnectDrive(c)}
                              className="flex items-center gap-1 text-[10px] font-bold text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50 shrink-0"
                              title="Conectar Google Drive à empresa"
                            >
                              {connectingDriveCompanyId === c.id ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  <span>Conectando...</span>
                                </>
                              ) : (
                                <>
                                  <CloudUpload className="w-3 h-3" />
                                  <span>Vincular Drive</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  ID: <code className="font-mono text-slate-600">{c.id}</code>
                </span>

                {!isActive && (
                  <button
                    onClick={() => switchCompany(c.id)}
                    className="flex items-center gap-1 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 py-1.5 rounded-xl transition-colors"
                  >
                    <span>Alternar para Esta Empresa</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* New Company Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn w-full max-w-full overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Cadastrar Nova Empresa</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCompany} className="mt-4 space-y-3.5">
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
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none uppercase"
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
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">CNPJ</label>
                <input
                  type="text"
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value.toUpperCase())}
                  placeholder="00.000.000/0001-00"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none uppercase"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">E-mail</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value.toLowerCase())}
                    placeholder="contato@empresa.com"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none lowercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Telefone</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.toUpperCase())}
                    placeholder="(11) 3333-4444"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Endereço</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value.toUpperCase())}
                  placeholder="RUA / AVENIDA, NÚMERO, BAIRRO, CIDADE - UF"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none uppercase"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-sm transition-colors"
                >
                  Cadastrar Empresa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
