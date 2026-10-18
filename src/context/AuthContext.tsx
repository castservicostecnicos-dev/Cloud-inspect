import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Company, UserRole } from '../types';
import { FirestoreService } from '../lib/firestoreSync';

interface AuthContextType {
  user: User | null;
  company: Company | null;
  availableCompanies: Company[];
  token: string | null;
  loading: boolean;
  login: (email: string, password?: string) => Promise<boolean>;
  logout: () => void;
  switchRole: (role: UserRole) => void;
  switchCompany: (companyId: string) => void;
  canManageUsers: boolean;
  canManageCompanies: boolean;
  canManageCondos: boolean;
  canExecuteInspection: boolean;
  canApproveOrSupervise: boolean;
  isDev: boolean;
  canSwitchRoles: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const savedUserStr = localStorage.getItem('cast_inspect_user');
      if (!savedUserStr) return null;
      const parsed = JSON.parse(savedUserStr);
      // Migração automática: se havia perfil SUPERVISOR salvo, migra para GERENTE
      if (parsed && (parsed.role === 'SUPERVISOR' || (parsed.role as string) === 'SUPERVISOR')) {
        parsed.role = 'GERENTE';
        localStorage.setItem('cast_inspect_user', JSON.stringify(parsed));
      }
      return parsed;
    } catch {
      return null;
    }
  });
  const [company, setCompany] = useState<Company | null>(() => {
    try {
      const savedCompanyStr = localStorage.getItem('cast_inspect_company');
      return savedCompanyStr ? JSON.parse(savedCompanyStr) : null;
    } catch {
      return null;
    }
  });
  const [availableCompanies, setAvailableCompanies] = useState<Company[]>([]);
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('cast_inspect_token') || null;
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [originalRole, setOriginalRole] = useState<UserRole | null>(() => {
    return (localStorage.getItem('cast_inspect_orig_role') as UserRole) || null;
  });

  // Background refresh of available companies and session validation (Multi-tenant scoped)
  useEffect(() => {
    let isMounted = true;

    async function init() {
      // Non-DEV users ONLY have access to their own assigned company
      if (user && user.role !== 'DEV') {
        if (company && isMounted) {
          setAvailableCompanies([company]);
        }
        return;
      }

      try {
        const resComp = await fetch('/api/companies', {
          headers: {
            ...(company ? { 'x-company-id': company.id } : {}),
            ...(user ? { 'x-user-role': user.role } : {}),
          },
        });
        if (resComp.ok && isMounted) {
          const comps = await resComp.json();
          if (Array.isArray(comps)) {
            setAvailableCompanies(comps);
          }
        }
      } catch (err) {
        console.warn('[Auth] Aviso ao buscar empresas em segundo plano:', err);
      }
    }

    init();

    return () => {
      isMounted = false;
    };
  }, [user?.role, company?.id]);

  const login = async (email: string, password?: string): Promise<boolean> => {
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      attempts++;
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        // Retry automático caso ocorra instabilidade temporária na conexão
        if ((res.status === 502 || res.status === 503 || res.status === 504) && attempts < maxAttempts) {
          await new Promise((r) => setTimeout(r, 1500));
          continue;
        }

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Erro ao realizar login.');
        }

        const data = await res.json();
        setUser(data.user);
        setCompany(data.company);
        setToken(data.token);
        setOriginalRole(data.user.role);

        // Marca servidor como ativo na sessão
        try {
          sessionStorage.setItem('cast_server_warmed_at', Date.now().toString());
        } catch {
          // ignore
        }

        // Strict isolation: non-DEV users are strictly limited to their own company
        if (data.user.role === 'DEV') {
          try {
            const resComp = await fetch('/api/companies', {
              headers: { 'x-user-role': 'DEV' },
            });
            if (resComp.ok) {
              const comps = await resComp.json();
              setAvailableCompanies(comps);
            }
          } catch {
            setAvailableCompanies([data.company]);
          }
        } else {
          setAvailableCompanies([data.company]);
        }

        localStorage.setItem('cast_inspect_user', JSON.stringify(data.user));
        localStorage.setItem('cast_inspect_company', JSON.stringify(data.company));
        localStorage.setItem('cast_inspect_token', data.token);
        localStorage.setItem('cast_inspect_orig_role', data.user.role);
        return true;
      } catch (err: any) {
        // Se for erro de rede temporário, aguarda e tenta novamente
        if (
          attempts < maxAttempts &&
          (err?.message === 'Failed to fetch' || err?.message?.includes('fetch') || err?.message?.includes('network'))
        ) {
          await new Promise((r) => setTimeout(r, 1500));
          continue;
        }
        console.warn('Login error:', err.message);
        throw err;
      }
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    setCompany(null);
    setToken(null);
    setOriginalRole(null);
    localStorage.removeItem('cast_inspect_user');
    localStorage.removeItem('cast_inspect_company');
    localStorage.removeItem('cast_inspect_token');
    localStorage.removeItem('cast_inspect_orig_role');
  };

  // Switch role directly (allows demonstrating the app across different user types)
  const switchRole = (newRole: UserRole) => {
    if (!user) return;
    let newName = user.name;
    let newDoc = user.docRegistration;

    if (newRole === 'DEV') {
      newName =
        user.email === 'cast.servicostecnicos@gmail.com' || user.email === 'ale11062@gmail.com'
          ? user.name
          : 'Equipe de Desenvolvimento (Dev)';
      newDoc = undefined;
    } else if (newRole === 'GERENTE') {
      newName = 'Eng. Carlos Eduardo Castilho';
      newDoc = 'CREA-SP 5069213890/D';
    } else if (newRole === 'TECNICO') {
      newName = 'Téc. Lucas Silva Ferreira';
      newDoc = 'CFT-SP 209381920';
    } else if (newRole === 'ADM_PREDIAL') {
      newName = 'Roberto Andrade (Síndico)';
      newDoc = undefined;
    }

    const devEmail =
      user.id === 'usr_dev_cast' || user.email === 'cast.servicostecnicos@gmail.com'
        ? 'cast.servicostecnicos@gmail.com'
        : user.id === 'usr_dev_ale' || user.email === 'ale11062@gmail.com'
        ? 'ale11062@gmail.com'
        : 'dev@castinspect.com.br';

    const updated: User = {
      ...user,
      role: newRole,
      name: newName,
      docRegistration: newDoc,
      email:
        newRole === 'DEV'
          ? devEmail
          : `${newRole.toLowerCase()}@${
              company?.tradeName?.toLowerCase().includes('alpha')
                ? 'alpha.com.br'
                : 'cast.com.br'
            }`,
    };

    setUser(updated);
    localStorage.setItem('cast_inspect_user', JSON.stringify(updated));
  };

  // Switch company (demonstrating multi-empresa data isolation - strictly DEV)
  const switchCompany = (newCompanyId: string) => {
    if (originalRole !== 'DEV' && user?.role !== 'DEV') {
      console.warn('Operação bloqueada: Apenas o perfil DEV possui permissão para alternar entre empresas.');
      return;
    }

    const targetComp = availableCompanies.find((c) => c.id === newCompanyId);
    if (!targetComp) return;

    setCompany(targetComp);
    localStorage.setItem('cast_inspect_company', JSON.stringify(targetComp));

    if (user) {
      const updatedUser: User = {
        ...user,
        companyId: newCompanyId,
        companyName: targetComp.name,
      };
      setUser(updatedUser);
      localStorage.setItem('cast_inspect_user', JSON.stringify(updatedUser));
    }
  };

  // Permission flags based on role (Supervisor unificado no Gerente)
  const isDev = user?.role === 'DEV';
  // A alternância rápida de perfis é permitida para demonstrar o funcionamento do app
  const canSwitchRoles = true;
  const canManageUsers = user?.role === 'GERENTE';
  const canManageCompanies = isDev;
  const canManageCondos = user?.role === 'GERENTE';
  const canExecuteInspection = user?.role === 'TECNICO' || user?.role === 'GERENTE';
  const canApproveOrSupervise = user?.role === 'GERENTE';

  return (
    <AuthContext.Provider
      value={{
        user,
        company,
        availableCompanies,
        token,
        loading,
        login,
        logout,
        switchRole,
        switchCompany,
        canManageUsers,
        canManageCompanies,
        canManageCondos,
        canExecuteInspection,
        canApproveOrSupervise,
        isDev,
        canSwitchRoles,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return context;
};
