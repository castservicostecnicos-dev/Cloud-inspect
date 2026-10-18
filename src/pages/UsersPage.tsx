import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  Trash2,
  Edit2,
  CheckCircle2,
  X,
  Lock,
  Mail,
  Award,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { User, UserRole } from '../types';

export const UsersPage: React.FC = () => {
  const { user, company, canManageUsers } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('TECNICO');
  const [docRegistration, setDocRegistration] = useState('');

  const fetchUsers = async () => {
    if (!company) return;
    setLoading(true);
    try {
      const res = await fetch('/api/users', {
        headers: { 'x-company-id': company.id },
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [company]);

  const openNewModal = () => {
    setEditingUser(null);
    setName('');
    setEmail('');
    setPassword('');
    setRole('TECNICO');
    setDocRegistration('');
    setIsModalOpen(true);
  };

  const openEditModal = (u: User) => {
    setEditingUser(u);
    setName(u.name);
    setEmail(u.email);
    setPassword('');
    setRole(u.role);
    setDocRegistration(u.docRegistration || '');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;

    const payload: Partial<User> = {
      companyId: company.id,
      name: name.trim().toUpperCase(),
      email: email.trim().toLowerCase(),
      role,
      docRegistration: docRegistration.trim().toUpperCase() || undefined,
      active: true,
    };
    if (password.trim()) {
      payload.password = password.trim();
    }

    try {
      const method = editingUser ? 'PUT' : 'POST';
      const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-company-id': company.id,
          'x-user-role': user?.role || 'GERENTE',
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setIsModalOpen(false);
        fetchUsers();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Erro ao salvar usuário.');
      }
    } catch (e) {
      alert('Erro de conexão ao salvar usuário.');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
        headers: { 'x-company-id': company?.id || '' },
      });
      if (res.ok) {
        fetchUsers();
      }
    } catch (e) {
      console.error('Erro ao excluir usuário:', e);
    }
  };

  const getRoleBadge = (r: UserRole | string) => {
    switch (r) {
      case 'GERENTE':
      case 'SUPERVISOR':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'TECNICO':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'ADM_PREDIAL':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 pb-16 w-full max-w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900">
            Usuários e Controle de Acesso (RBAC)
          </h1>
        </div>

        {canManageUsers && (
          <button
            onClick={openNewModal}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl shadow-md shadow-blue-600/20 transition-all active:scale-95 shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            <span>Novo Usuário</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
          <span className="text-xs font-semibold">Carregando usuários...</span>
        </div>
      ) : (
        <div className="w-full max-w-full space-y-3">
          {/* Mobile View: Cards (Fits perfectly within mobile screen without horizontal scroll) */}
          <div className="md:hidden space-y-3">
            {users.map((u) => (
              <div
                key={u.id}
                className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-slate-900 text-sm truncate">{u.name}</div>
                    <div className="text-xs text-slate-500 font-mono break-all flex items-center gap-1 mt-0.5">
                      <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">{u.email}</span>
                    </div>
                  </div>
                  <span
                    className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${getRoleBadge(
                      u.role
                    )}`}
                  >
                    {u.role}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 pt-2 border-t border-slate-100">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Registro Técnico:</span>
                    {u.docRegistration ? (
                      <span className="font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 text-[10px]">
                        {u.docRegistration}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Status:</span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Ativo
                    </span>
                  </div>
                </div>

                {canManageUsers && (
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                    <button
                      onClick={() => openEditModal(u)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-blue-600" />
                      <span>Editar</span>
                    </button>
                    <button
                      onClick={() => handleDelete(u.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Excluir</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop View: Table */}
          <div className="hidden md:block bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs w-full max-w-full">
            <div className="overflow-x-auto w-full max-w-full">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="p-4">Nome / Identificação</th>
                    <th className="p-4">Perfil (Role)</th>
                    <th className="p-4">Registro Técnico</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-slate-900">{u.name}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Mail className="w-3 h-3 text-slate-400" />
                          <span>{u.email}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-block text-[10px] font-bold px-2.5 py-1 rounded-md border ${getRoleBadge(
                            u.role
                          )}`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="p-4">
                        {u.docRegistration ? (
                          <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                            {u.docRegistration}
                          </span>
                        ) : (
                          <span className="text-slate-400">&mdash;</span>
                        )}
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Ativo
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        {canManageUsers && (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openEditModal(u)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(u.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn w-full max-w-full overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {editingUser ? 'Editar Usuário' : 'Novo Usuário do Sistema'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nome Completo *
                </label>
                <input
                  required
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value.toUpperCase())}
                  placeholder="Nome do colaborador"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  E-mail de Login *
                </label>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value.toLowerCase())}
                  placeholder="email@empresa.com.br"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none lowercase"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {editingUser ? 'Nova Senha (deixe em branco p/ manter)' : 'Senha de Acesso *'}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Perfil de Acesso (Papel) *
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="GERENTE">GERENTE — Gestão da equipe, condomínios, aprovações e vistorias</option>
                  <option value="TECNICO">TÉCNICO — Realiza vistorias em campo, fotos e assinaturas</option>
                  <option value="ADM_PREDIAL">ADM PREDIAL / SÍNDICO — Visualiza relatórios do condomínio</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Registro Profissional (CREA / CFT / CAU)
                </label>
                <input
                  type="text"
                  value={docRegistration}
                  onChange={(e) => setDocRegistration(e.target.value.toUpperCase())}
                  placeholder="Ex: CFT-SP 1234567"
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
                  Salvar Usuário
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
